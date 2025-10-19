import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as sharp from 'sharp';
import * as mime from 'mime-types';
import { PrismaService } from './prisma.service';

export interface FileUploadOptions {
  organizationId: string;
  uploadedBy: string;
  category: 'EVIDENCE' | 'REPORT' | 'CERTIFICATE' | 'INVOICE' | 'PHOTO' | 'DOCUMENT' | 'OTHER';
  description?: string;
  tags?: string[];
  associatedRecordId?: string;
  associatedRecordType?: string;
  isPublic?: boolean;
}

export interface StoredFile {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  checksum: string;
  isProcessed: boolean;
  metadata: FileMetadata;
}

export interface FileMetadata {
  dimensions?: { width: number; height: number };
  duration?: number; // for videos/audio
  pageCount?: number; // for PDFs
  extractedText?: string;
  thumbnailPath?: string;
  virusScanned?: boolean;
  virusScanResult?: 'CLEAN' | 'INFECTED' | 'SUSPICIOUS';
  processedAt?: Date;
}

export interface FileFilter {
  organizationId: string;
  category?: string;
  mimeType?: string;
  tags?: string[];
  uploadedBy?: string;
  associatedRecordType?: string;
  associatedRecordId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  isPublic?: boolean;
}

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadPath: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: Set<string>;
  private readonly virusScanEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH', './uploads');
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 50 * 1024 * 1024); // 50MB
    this.virusScanEnabled = this.configService.get<boolean>('VIRUS_SCAN_ENABLED', true);
    
    this.allowedMimeTypes = new Set([
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      
      // Other
      'application/json',
      'application/xml'
    ]);

    this.ensureUploadDirectory();
  }

  /**
   * Upload and store file
   */
  async uploadFile(
    file: Express.Multer.File,
    options: FileUploadOptions
  ): Promise<StoredFile> {
    // Validate file
    this.validateFile(file);

    // Generate unique filename and path
    const fileId = this.generateFileId();
    const fileExtension = path.extname(file.originalname);
    const filename = `${fileId}${fileExtension}`;
    const organizationDir = path.join(this.uploadPath, options.organizationId);
    const categoryDir = path.join(organizationDir, options.category.toLowerCase());
    const filePath = path.join(categoryDir, filename);

    // Ensure directories exist
    await this.ensureDirectoryExists(categoryDir);

    // Calculate file checksum
    const checksum = this.calculateChecksum(file.buffer);

    // Check for duplicates
    const existingFile = await this.findDuplicateFile(options.organizationId, checksum);
    if (existingFile) {
      this.logger.warn(`Duplicate file detected: ${file.originalname} (${checksum})`);
      // Could either reject or return existing file
      return this.mapToStoredFile(existingFile);
    }

    // Save file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    // Create database record
    const fileRecord = await this.prisma.uploadedFile.create({
      data: {
        id: fileId,
        originalName: file.originalname,
        filename,
        mimeType: file.mimetype,
        size: file.size,
        path: filePath,
        checksum,
        organizationId: options.organizationId,
        uploadedBy: options.uploadedBy,
        category: options.category,
        description: options.description,
        tags: options.tags || [],
        associatedRecordId: options.associatedRecordId,
        associatedRecordType: options.associatedRecordType,
        isPublic: options.isPublic || false,
        isProcessed: false,
        metadata: {}
      }
    });

    this.logger.log(`File uploaded: ${file.originalname} -> ${fileId}`);

    // Queue for background processing
    await this.queueFileProcessing(fileRecord);

    return this.mapToStoredFile(fileRecord);
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Express.Multer.File[],
    options: FileUploadOptions
  ): Promise<StoredFile[]> {
    const results: StoredFile[] = [];

    for (const file of files) {
      try {
        const storedFile = await this.uploadFile(file, options);
        results.push(storedFile);
      } catch (error) {
        this.logger.error(`Failed to upload file ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    return results;
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string, organizationId: string): Promise<StoredFile | null> {
    const fileRecord = await this.prisma.uploadedFile.findFirst({
      where: {
        id: fileId,
        OR: [
          { organizationId },
          { isPublic: true }
        ]
      }
    });

    return fileRecord ? this.mapToStoredFile(fileRecord) : null;
  }

  /**
   * Get file stream for download
   */
  async getFileStream(fileId: string, organizationId: string): Promise<{
    stream: fs.ReadStream;
    file: StoredFile;
  } | null> {
    const file = await this.getFile(fileId, organizationId);
    
    if (!file) {
      return null;
    }

    // Check if file exists on disk
    if (!fs.existsSync(file.path)) {
      this.logger.error(`File not found on disk: ${file.path}`);
      throw new Error('File not found on disk');
    }

    const stream = fs.createReadStream(file.path);
    return { stream, file };
  }

  /**
   * Get files with filters
   */
  async getFiles(filter: FileFilter, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    const where: any = {
      organizationId: filter.organizationId
    };

    if (filter.category) {
      where.category = filter.category;
    }

    if (filter.mimeType) {
      where.mimeType = { contains: filter.mimeType };
    }

    if (filter.tags && filter.tags.length > 0) {
      where.tags = {
        hasSome: filter.tags
      };
    }

    if (filter.uploadedBy) {
      where.uploadedBy = filter.uploadedBy;
    }

    if (filter.associatedRecordType) {
      where.associatedRecordType = filter.associatedRecordType;
    }

    if (filter.associatedRecordId) {
      where.associatedRecordId = filter.associatedRecordId;
    }

    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = filter.dateFrom;
      if (filter.dateTo) where.createdAt.lte = filter.dateTo;
    }

    if (filter.isPublic !== undefined) {
      where.isPublic = filter.isPublic;
    }

    const [files, total] = await Promise.all([
      this.prisma.uploadedFile.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          uploadedByUser: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }),
      this.prisma.uploadedFile.count({ where })
    ]);

    return {
      files: files.map(file => this.mapToStoredFile(file)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, organizationId: string, deletedBy: string): Promise<boolean> {
    const file = await this.prisma.uploadedFile.findFirst({
      where: {
        id: fileId,
        organizationId
      }
    });

    if (!file) {
      throw new Error('File not found');
    }

    // Soft delete in database
    await this.prisma.uploadedFile.update({
      where: { id: fileId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy
      }
    });

    // Queue for physical deletion (could be done immediately or scheduled)
    await this.queueFileDeletion(file.path);

    this.logger.log(`File deleted: ${fileId} by ${deletedBy}`);
    return true;
  }

  /**
   * Generate file URL
   */
  generateFileUrl(fileId: string): string {
    const baseUrl = this.configService.get<string>('API_BASE_URL', 'http://localhost:3001');
    return `${baseUrl}/files/${fileId}`;
  }

  /**
   * Generate signed URL for temporary access
   */
  generateSignedUrl(fileId: string, expiresIn: number = 3600): string {
    const payload = {
      fileId,
      exp: Math.floor(Date.now() / 1000) + expiresIn
    };

    const secret = this.configService.get<string>('JWT_SECRET', 'secret');
    const token = this.signPayload(payload, secret);
    
    return `${this.generateFileUrl(fileId)}?token=${token}`;
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(organizationId: string) {
    const stats = await this.prisma.uploadedFile.aggregate({
      where: {
        organizationId,
        isDeleted: false
      },
      _count: {
        id: true
      },
      _sum: {
        size: true
      }
    });

    const categoryStats = await this.prisma.uploadedFile.groupBy({
      by: ['category'],
      where: {
        organizationId,
        isDeleted: false
      },
      _count: {
        id: true
      },
      _sum: {
        size: true
      }
    });

    return {
      totalFiles: stats._count.id || 0,
      totalSize: stats._sum.size || 0,
      categoryBreakdown: categoryStats.map(stat => ({
        category: stat.category,
        fileCount: stat._count.id,
        totalSize: stat._sum.size || 0
      }))
    };
  }

  /**
   * Process file (virus scan, thumbnail generation, text extraction)
   */
  private async queueFileProcessing(fileRecord: any): Promise<void> {
    // This would typically queue a background job
    // For now, we'll do basic processing synchronously
    
    try {
      const metadata: FileMetadata = {};

      // Virus scan
      if (this.virusScanEnabled) {
        metadata.virusScanResult = await this.performVirusScan(fileRecord.path);
        metadata.virusScanned = true;
      }

      // Generate thumbnails for images
      if (fileRecord.mimeType.startsWith('image/')) {
        const dimensions = await this.getImageDimensions(fileRecord.path);
        metadata.dimensions = dimensions;
        
        if (dimensions && this.shouldGenerateThumbnail(fileRecord.mimeType)) {
          metadata.thumbnailPath = await this.generateThumbnail(fileRecord.path, fileRecord.id);
        }
      }

      // Extract text from PDFs
      if (fileRecord.mimeType === 'application/pdf') {
        metadata.extractedText = await this.extractPdfText(fileRecord.path);
        metadata.pageCount = await this.getPdfPageCount(fileRecord.path);
      }

      // Update database with processed metadata
      await this.prisma.uploadedFile.update({
        where: { id: fileRecord.id },
        data: {
          isProcessed: true,
          metadata: metadata as any,
          processedAt: new Date()
        }
      });

      this.logger.log(`File processing completed: ${fileRecord.id}`);

    } catch (error) {
      this.logger.error(`File processing failed for ${fileRecord.id}:`, error);
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size is ${this.maxFileSize / (1024 * 1024)}MB`
      );
    }

    // Check mime type
    if (!this.allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed: ${file.mimetype}`
      );
    }

    // Check for potentially dangerous file extensions
    const extension = path.extname(file.originalname).toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js'];
    
    if (dangerousExtensions.includes(extension)) {
      throw new BadRequestException(
        `File extension not allowed: ${extension}`
      );
    }

    // Basic file header validation (magic number check)
    if (!this.validateFileHeader(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'File content does not match declared type'
      );
    }
  }

  /**
   * Validate file header against mime type
   */
  private validateFileHeader(buffer: Buffer, mimeType: string): boolean {
    // Basic magic number checks
    const signatures = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'application/zip': [0x50, 0x4B, 0x03, 0x04],
    };

    const signature = signatures[mimeType];
    if (!signature) {
      return true; // No signature to check
    }

    return signature.every((byte, index) => buffer[index] === byte);
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Find duplicate file by checksum
   */
  private async findDuplicateFile(organizationId: string, checksum: string) {
    return this.prisma.uploadedFile.findFirst({
      where: {
        organizationId,
        checksum,
        isDeleted: false
      }
    });
  }

  /**
   * Generate unique file ID
   */
  private generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDirectory(): Promise<void> {
    if (!fs.existsSync(this.uploadPath)) {
      await fs.promises.mkdir(this.uploadPath, { recursive: true });
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Map database record to StoredFile
   */
  private mapToStoredFile(record: any): StoredFile {
    return {
      id: record.id,
      originalName: record.originalName,
      filename: record.filename,
      mimeType: record.mimeType,
      size: record.size,
      path: record.path,
      url: this.generateFileUrl(record.id),
      checksum: record.checksum,
      isProcessed: record.isProcessed,
      metadata: record.metadata || {}
    };
  }

  /**
   * Perform virus scan (mock implementation)
   */
  private async performVirusScan(filePath: string): Promise<'CLEAN' | 'INFECTED' | 'SUSPICIOUS'> {
    // This would integrate with ClamAV or similar
    // Mock implementation always returns CLEAN
    return 'CLEAN';
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(imagePath: string): Promise<{ width: number; height: number } | null> {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0
      };
    } catch (error) {
      this.logger.warn(`Failed to get image dimensions for ${imagePath}:`, error);
      return null;
    }
  }

  /**
   * Generate thumbnail for image
   */
  private async generateThumbnail(imagePath: string, fileId: string): Promise<string> {
    const thumbnailPath = path.join(
      path.dirname(imagePath),
      'thumbnails',
      `${fileId}_thumb.jpg`
    );

    await this.ensureDirectoryExists(path.dirname(thumbnailPath));

    await sharp(imagePath)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  }

  /**
   * Check if should generate thumbnail
   */
  private shouldGenerateThumbnail(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
  }

  /**
   * Extract text from PDF (mock implementation)
   */
  private async extractPdfText(pdfPath: string): Promise<string> {
    // This would use a library like pdf-parse
    // Mock implementation
    return '';
  }

  /**
   * Get PDF page count (mock implementation)
   */
  private async getPdfPageCount(pdfPath: string): Promise<number> {
    // This would use a PDF library
    // Mock implementation
    return 1;
  }

  /**
   * Queue file for physical deletion
   */
  private async queueFileDeletion(filePath: string): Promise<void> {
    // This would typically queue a background job
    // For now, delete immediately
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        
        // Also delete thumbnail if exists
        const thumbnailPath = path.join(
          path.dirname(filePath),
          'thumbnails',
          `${path.parse(filePath).name}_thumb.jpg`
        );
        
        if (fs.existsSync(thumbnailPath)) {
          await fs.promises.unlink(thumbnailPath);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to delete file ${filePath}:`, error);
    }
  }

  /**
   * Sign payload for signed URLs
   */
  private signPayload(payload: any, secret: string): string {
    // Simple signing implementation
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');
    
    return Buffer.from(data).toString('base64url') + '.' + signature;
  }
}