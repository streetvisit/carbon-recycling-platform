// utils/r2Client.ts - AWS S3 compatible client for Cloudflare R2 uploads
// Compatible with Cloudflare Workers (uses Web Crypto API)

interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  bucketName: string;
  region?: string;
}

interface UploadResult {
  success: boolean;
  fileUrl?: string;
  error?: string;
}

export class R2Client {
  private config: R2Config;

  constructor(config: R2Config) {
    this.config = {
      ...config,
      region: config.region || 'auto'
    };
  }

  /**
   * Upload a file buffer to R2 with proper AWS v4 signature
   */
  async uploadFile(
    fileBuffer: ArrayBuffer, 
    fileName: string, 
    contentType: string = 'application/pdf'
  ): Promise<UploadResult> {
    try {
      const now = new Date();
      const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
      
      const url = `${this.config.endpoint}/${this.config.bucketName}/${fileName}`;
      const host = new URL(this.config.endpoint).host;
      
      // Create canonical request
      const method = 'PUT';
      const canonicalUri = `/${this.config.bucketName}/${fileName}`;
      const canonicalQueryString = '';
      
      // Headers
      const headers: Record<string, string> = {
        'host': host,
        'x-amz-content-sha256': await this.sha256(new Uint8Array(fileBuffer)),
        'x-amz-date': timeString,
        'content-type': contentType,
        'content-length': fileBuffer.byteLength.toString()
      };
      
      const canonicalHeaders = Object.keys(headers)
        .sort()
        .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
        .join('');
      
      const signedHeaders = Object.keys(headers)
        .sort()
        .map(key => key.toLowerCase())
        .join(';');
      
      const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        headers['x-amz-content-sha256']
      ].join('\n');
      
      // Create string to sign
      const credentialScope = `${dateString}/${this.config.region}/s3/aws4_request`;
      const stringToSign = [
        'AWS4-HMAC-SHA256',
        timeString,
        credentialScope,
await this.sha256(canonicalRequest)
      ].join('\n');
      
      // Calculate signature
      const signature = await this.calculateSignature(
        this.config.secretAccessKey,
        dateString,
        this.config.region,
        's3',
        stringToSign
      );
      
      // Create authorization header
      const authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      
      // Make the upload request
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...headers,
          'Authorization': authorization
        },
        body: fileBuffer
      });

      if (response.ok) {
        return {
          success: true,
          fileUrl: url
        };
      } else {
        const errorText = await response.text();
        return {
          success: false,
          error: `R2 upload failed: ${response.status} ${response.statusText} - ${errorText}`
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      };
    }
  }

  /**
   * Generate a signed URL for downloading a file
   */
  async getSignedDownloadUrl(fileName: string, expiresIn: number = 3600): Promise<string> {
    const now = new Date();
    const expirationTime = Math.floor(now.getTime() / 1000) + expiresIn;
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    
    const host = new URL(this.config.endpoint).host;
    const canonicalUri = `/${this.config.bucketName}/${fileName}`;
    
    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.config.accessKeyId}/${dateString}/${this.config.region}/s3/aws4_request`,
      'X-Amz-Date': timeString,
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': 'host'
    });
    
    const canonicalQueryString = queryParams.toString();
    
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      'host:' + host + '\n',
      'host',
      'UNSIGNED-PAYLOAD'
    ].join('\n');
    
    const credentialScope = `${dateString}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timeString,
      credentialScope,
await this.sha256(canonicalRequest)
    ].join('\n');
    
    const signature = await this.calculateSignature(
      this.config.secretAccessKey,
      dateString,
      this.config.region,
      's3',
      stringToSign
    );
    
    queryParams.set('X-Amz-Signature', signature);
    
    return `${this.config.endpoint}${canonicalUri}?${queryParams.toString()}`;
  }

  private async sha256(data: string | Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async calculateSignature(
    secretKey: string,
    dateString: string,
    region: string,
    service: string,
    stringToSign: string
  ): Promise<string> {
    const kDate = await this.hmacSha256(`AWS4${secretKey}`, dateString);
    const kRegion = await this.hmacSha256(kDate, region);
    const kService = await this.hmacSha256(kRegion, service);
    const kSigning = await this.hmacSha256(kService, 'aws4_request');
    return await this.hmacSha256Hex(kSigning, stringToSign);
  }

  private async hmacSha256(key: string | Uint8Array, data: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const keyBuffer = typeof key === 'string' ? encoder.encode(key) : key;
    const dataBuffer = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return new Uint8Array(signature);
  }

  private async hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
    const signature = await this.hmacSha256(key, data);
    return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('');
  }
    return signature;
  }
}