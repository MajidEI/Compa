import { Router, Request, Response, NextFunction } from 'express';
import { SalesforceService } from '../services/salesforce.service';
import { ProfileNormalizer, PermissionSetNormalizer } from '../services/normalizer.service';
import { DiffEngine } from '../services/diff.service';
import { CompareRequest, CompareResponse, ProfileListResponse } from '../types';

const router = Router();

/**
 * Middleware to ensure user is authenticated
 * All profile routes require a valid Salesforce session
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
 * GET /profiles
 * 
 * Fetch all profiles in the connected Salesforce org.
 * Returns a list of profile IDs and names for the selection UI.
 * 
 * Response: { profiles: [{ id: string, name: string }] }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sfService = new SalesforceService(req.session.salesforce!);
    const profiles = await sfService.getAllProfiles();
    
    const response: ProfileListResponse = {
      profiles: profiles.map(p => ({
        id: p.Id,
        name: p.Name,
      })),
    };
    
    res.json(response);
  } catch (err: any) {
    console.error('Error fetching profiles:', err.response?.data || err.message);
    
    // Handle specific Salesforce API errors
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired. Please re-authenticate.' });
    }
    
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

/**
 * POST /profiles/compare
 * 
 * Compare two or more profiles and return a detailed diff.
 * 
 * Request body: { profileIds: string[] }
 * Response: { comparison: ComparisonResult, profiles: NormalizedProfile[] }
 * 
 * The comparison includes:
 * - Object permissions differences
 * - Field permissions differences
 * - System permissions differences
 * - Apex class access differences
 * - Visualforce page access differences
 * - And more...
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { profileIds } = req.body as CompareRequest;
    
    // Validate request
    if (!profileIds || !Array.isArray(profileIds)) {
      return res.status(400).json({ error: 'profileIds array is required' });
    }
    
    if (profileIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 profiles are required for comparison' });
    }
    
    if (profileIds.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 profiles can be compared at once' });
    }
    
    // Validate profile ID format (Salesforce ID is 15 or 18 characters)
    const invalidIds = profileIds.filter(id => !/^[a-zA-Z0-9]{15,18}$/.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: `Invalid profile ID format: ${invalidIds.join(', ')}` });
    }
    
    console.log(`Comparing ${profileIds.length} profiles: ${profileIds.join(', ')}`);
    
    // Step 1: Normalize profiles
    // This fetches all permission data and transforms it into a consistent structure
    const normalizer = new ProfileNormalizer(req.session.salesforce!);
    const normalizedProfiles = await normalizer.normalizeProfiles(profileIds);
    
    if (normalizedProfiles.length < 2) {
      return res.status(400).json({ error: 'Could not find enough valid profiles' });
    }
    
    // Step 2: Run the diff engine
    const diffEngine = new DiffEngine();
    const comparison = diffEngine.compare(normalizedProfiles);
    
    console.log(`Comparison complete. Found ${comparison.totalDifferences} differences.`);
    
    const response: CompareResponse = {
      comparison,
      profiles: normalizedProfiles,
    };
    
    res.json(response);
  } catch (err: any) {
    console.error('Error comparing profiles:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired. Please re-authenticate.' });
    }
    
    res.status(500).json({ 
      error: 'Failed to compare profiles',
      details: err.message,
    });
  }
});

/**
 * GET /profiles/:id
 * 
 * Get detailed normalized data for a single profile.
 * Useful for inspecting a profile's full configuration.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate profile ID format
    if (!/^[a-zA-Z0-9]{15,18}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid profile ID format' });
    }
    
    const normalizer = new ProfileNormalizer(req.session.salesforce!);
    const [profile] = await normalizer.normalizeProfiles([id]);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(profile);
  } catch (err: any) {
    console.error('Error fetching profile:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired. Please re-authenticate.' });
    }
    
    res.status(500).json({ error: 'Failed to fetch profile details' });
  }
});

// =============================================================================
// PERMISSION SET ROUTES
// =============================================================================

/**
 * GET /profiles/permission-sets
 * 
 * Fetch all permission sets in the connected Salesforce org.
 */
router.get('/permission-sets/list', async (req: Request, res: Response) => {
  try {
    const sfService = new SalesforceService(req.session.salesforce!);
    const permissionSets = await sfService.getAllPermissionSets();
    
    res.json({
      permissionSets: permissionSets.map(ps => ({
        id: ps.Id,
        name: ps.Name,
        label: ps.Label,
        description: ps.Description,
        isCustom: ps.IsCustom,
        type: ps.Type || 'Regular',
      })),
    });
  } catch (err: any) {
    console.error('Error fetching permission sets:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired. Please re-authenticate.' });
    }
    
    res.status(500).json({ error: 'Failed to fetch permission sets' });
  }
});

/**
 * POST /profiles/permission-sets/compare
 * 
 * Compare permission sets (with optional profiles mixed in)
 */
router.post('/permission-sets/compare', async (req: Request, res: Response) => {
  try {
    const { permissionSetIds, includeProfiles = [] } = req.body as {
      permissionSetIds: string[];
      includeProfiles?: string[];
    };
    
    // Validate request
    if (!permissionSetIds || !Array.isArray(permissionSetIds)) {
      return res.status(400).json({ error: 'permissionSetIds array is required' });
    }
    
    const totalItems = permissionSetIds.length + (includeProfiles?.length || 0);
    if (totalItems < 2) {
      return res.status(400).json({ error: 'At least 2 items are required for comparison' });
    }
    
    if (totalItems > 10) {
      return res.status(400).json({ error: 'Maximum 10 items can be compared at once' });
    }
    
    console.log(`Comparing ${permissionSetIds.length} permission sets and ${includeProfiles.length} profiles`);
    
    // Normalize permission sets
    const psNormalizer = new PermissionSetNormalizer(req.session.salesforce!);
    const normalizedPermSets = await psNormalizer.normalizePermissionSets(permissionSetIds);
    
    // Optionally normalize and include profiles
    let allNormalized = [...normalizedPermSets];
    if (includeProfiles && includeProfiles.length > 0) {
      const profileNormalizer = new ProfileNormalizer(req.session.salesforce!);
      const normalizedProfiles = await profileNormalizer.normalizeProfiles(includeProfiles);
      allNormalized = [...allNormalized, ...normalizedProfiles];
    }
    
    if (allNormalized.length < 2) {
      return res.status(400).json({ error: 'Could not find enough valid items' });
    }
    
    // Run the diff engine
    const diffEngine = new DiffEngine();
    const comparison = diffEngine.compare(allNormalized);
    
    console.log(`Comparison complete. Found ${comparison.totalDifferences} differences.`);
    
    const response: CompareResponse = {
      comparison,
      profiles: allNormalized,
    };
    
    res.json(response);
  } catch (err: any) {
    console.error('Error comparing permission sets:', err.response?.data || err.message);
    
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Session expired. Please re-authenticate.' });
    }
    
    res.status(500).json({
      error: 'Failed to compare permission sets',
      details: err.message,
    });
  }
});

export default router;
