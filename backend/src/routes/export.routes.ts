import { Router, Request, Response, NextFunction } from 'express';
import { generateCSV, generateDetailedCSV, generateSummaryCSV, ExportOptions } from '../services/export.service';
import { CompareResponse } from '../types';

const router = Router();

/**
 * Middleware to ensure user is authenticated
 */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.salesforce?.accessToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * POST /export/csv
 * 
 * Generate a CSV export from comparison data.
 * The comparison data is sent in the request body (since we don't persist it).
 * 
 * Request body: {
 *   comparison: ComparisonResult,
 *   profiles: NormalizedProfile[],
 *   options: {
 *     format: 'differences' | 'detailed' | 'summary',
 *     includeUnchanged: boolean,
 *     categories?: string[]
 *   }
 * }
 */
router.post('/csv', (req: Request, res: Response) => {
  try {
    const { comparison, profiles, options } = req.body as {
      comparison: CompareResponse['comparison'];
      profiles: CompareResponse['profiles'];
      options: {
        format: 'differences' | 'detailed' | 'summary';
        includeUnchanged?: boolean;
        categories?: string[];
      };
    };
    
    if (!comparison || !profiles) {
      return res.status(400).json({ error: 'Comparison data is required' });
    }
    
    let csv: string;
    let filename: string;
    const timestamp = new Date().toISOString().split('T')[0];
    
    switch (options.format) {
      case 'detailed':
        csv = generateDetailedCSV(profiles);
        filename = `profile-comparison-detailed-${timestamp}.csv`;
        break;
      case 'summary':
        csv = generateSummaryCSV(comparison);
        filename = `profile-comparison-summary-${timestamp}.csv`;
        break;
      case 'differences':
      default:
        csv = generateCSV(comparison, profiles, {
          format: 'csv',
          includeUnchanged: options.includeUnchanged ?? false,
          categories: options.categories,
        });
        filename = `profile-comparison-differences-${timestamp}.csv`;
        break;
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: any) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Failed to generate export' });
  }
});

/**
 * POST /export/json
 * 
 * Export comparison data as JSON file
 */
router.post('/json', (req: Request, res: Response) => {
  try {
    const { comparison, profiles } = req.body as CompareResponse;
    
    if (!comparison || !profiles) {
      return res.status(400).json({ error: 'Comparison data is required' });
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `profile-comparison-${timestamp}.json`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json({ comparison, profiles, exportedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Failed to generate export' });
  }
});

export default router;
