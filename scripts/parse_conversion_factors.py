#!/usr/bin/env python3
"""
UK Government Conversion Factors Parser

Parses the 2025 UK Government GHG Conversion Factors from the flat-file format
and structures them into a JSON format suitable for the carbon recycling platform.

Data Source: UK Government GHG Conversion Factors 2025 (flat-file.xlsx)
Source URL: https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025
"""

import pandas as pd
import json
from pathlib import Path
from datetime import datetime
import logging
from typing import Dict, Any, List

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConversionFactorParser:
    def __init__(self, excel_file_path: str):
        self.excel_file_path = Path(excel_file_path)
        self.conversion_factors = []
        self.metadata = {
            "source": "UK Government GHG Conversion Factors 2025",
            "source_url": "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2025",
            "year": 2025,
            "parsed_at": datetime.now().isoformat(),
            "total_factors": 0,
            "categories": {},
            "scopes": {}
        }
    
    def parse_excel(self) -> None:
        """Parse the Excel file and extract conversion factors."""
        logger.info(f"Parsing conversion factors from {self.excel_file_path}")
        
        try:
            # Read the main data sheet, skipping header rows
            df = pd.read_excel(
                self.excel_file_path, 
                sheet_name='Factors by Category', 
                skiprows=4
            )
            
            # Set proper column names
            df.columns = [
                'ID', 'Scope', 'Level1', 'Level2', 'Level3', 'Level4', 
                'Column_Text', 'UOM', 'GHG_Unit', 'Conversion_Factor_2025'
            ]
            
            # Clean the data
            df = df.dropna(subset=['ID', 'Conversion_Factor_2025'])
            
            logger.info(f"Found {len(df)} conversion factors")
            
            # Convert to structured format
            self._process_dataframe(df)
            
        except Exception as e:
            logger.error(f"Error parsing Excel file: {e}")
            raise
    
    def _process_dataframe(self, df: pd.DataFrame) -> None:
        """Process the DataFrame and convert to structured format."""
        
        for _, row in df.iterrows():
            try:
                factor = self._create_factor_record(row)
                if factor:
                    self.conversion_factors.append(factor)
            except Exception as e:
                logger.warning(f"Error processing row {row.name}: {e}")
                continue
        
        # Update metadata
        self.metadata["total_factors"] = len(self.conversion_factors)
        self._calculate_metadata()
    
    def _create_factor_record(self, row: pd.Series) -> Dict[str, Any]:
        """Create a structured factor record from a DataFrame row."""
        
        # Skip invalid rows
        if pd.isna(row['ID']) or pd.isna(row['Conversion_Factor_2025']):
            return None
        
        # Clean and structure the data
        factor = {
            "id": str(row['ID']).strip(),
            "scope": str(row['Scope']).strip() if pd.notna(row['Scope']) else None,
            "category": {
                "level1": str(row['Level1']).strip() if pd.notna(row['Level1']) else None,
                "level2": str(row['Level2']).strip() if pd.notna(row['Level2']) else None,
                "level3": str(row['Level3']).strip() if pd.notna(row['Level3']) else None,
                "level4": str(row['Level4']).strip() if pd.notna(row['Level4']) else None,
            },
            "units": {
                "activity_unit": str(row['UOM']).strip() if pd.notna(row['UOM']) else None,
                "emission_unit": str(row['GHG_Unit']).strip() if pd.notna(row['GHG_Unit']) else None,
            },
            "conversion_factor": float(row['Conversion_Factor_2025']),
            "column_text": str(row['Column_Text']).strip() if pd.notna(row['Column_Text']) else None,
            "year": 2025
        }
        
        # Add searchable tags
        factor["tags"] = self._generate_tags(factor)
        
        return factor
    
    def _generate_tags(self, factor: Dict[str, Any]) -> List[str]:
        """Generate searchable tags for a conversion factor."""
        tags = []
        
        # Add scope tags
        if factor["scope"]:
            tags.append(factor["scope"].lower().replace(" ", "_"))
        
        # Add category tags
        for level in factor["category"].values():
            if level and level.lower() != 'nan':
                # Split on common separators and add each part
                parts = str(level).lower().replace("(", " ").replace(")", " ").replace("-", " ").split()
                tags.extend(parts)
        
        # Add unit tags
        if factor["units"]["activity_unit"]:
            tags.append(factor["units"]["activity_unit"].lower())
        
        # Clean and deduplicate tags
        tags = list(set([tag.strip() for tag in tags if tag.strip() and len(tag.strip()) > 1]))
        
        return tags
    
    def _calculate_metadata(self) -> None:
        """Calculate metadata statistics."""
        
        # Count by scope
        scope_counts = {}
        category_counts = {}
        
        for factor in self.conversion_factors:
            scope = factor.get("scope")
            if scope:
                scope_counts[scope] = scope_counts.get(scope, 0) + 1
            
            level1 = factor.get("category", {}).get("level1")
            if level1:
                category_counts[level1] = category_counts.get(level1, 0) + 1
        
        self.metadata["scopes"] = scope_counts
        self.metadata["categories"] = dict(sorted(category_counts.items(), key=lambda x: x[1], reverse=True))
    
    def save_to_json(self, output_file: str) -> None:
        """Save the parsed conversion factors to a JSON file."""
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        data = {
            "metadata": self.metadata,
            "conversion_factors": self.conversion_factors
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved {len(self.conversion_factors)} conversion factors to {output_path}")
    
    def get_summary(self) -> str:
        """Get a summary of the parsed data."""
        summary = f"""
UK Government Conversion Factors 2025 - Parsing Summary
======================================================

Total Factors: {self.metadata['total_factors']:,}
Parsed At: {self.metadata['parsed_at']}

Top Categories:
{chr(10).join([f"  - {cat}: {count:,} factors" for cat, count in list(self.metadata['categories'].items())[:10]])}

Scopes:
{chr(10).join([f"  - {scope}: {count:,} factors" for scope, count in self.metadata['scopes'].items()])}
        """.strip()
        
        return summary

def main():
    """Main execution function."""
    
    # File paths
    excel_file = "reference-data/uk-gov-conversion-factors/2025/flat-file.xlsx"
    output_file = "src/data/conversion_factors_2025.json"
    
    try:
        # Parse the conversion factors
        parser = ConversionFactorParser(excel_file)
        parser.parse_excel()
        
        # Save to JSON
        parser.save_to_json(output_file)
        
        # Print summary
        print(parser.get_summary())
        
    except Exception as e:
        logger.error(f"Failed to parse conversion factors: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())