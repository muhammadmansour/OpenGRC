/**
 * OpenGRC Converter Utility
 * Converts Muraji library format to OpenGRC Bundle/Standard format
 */

/**
 * Convert a library to OpenGRC Bundle format
 * @param {Object} library - The library object from database
 * @returns {Object} OpenGRC Bundle format
 */
function convertToBundle(library) {
  if (!library) {
    return null;
  }

  const framework = library.content?.framework || {};
  
  return {
    code: library.ref_id || framework.ref_id || library.urn?.split(':').pop(),
    name: library.name || framework.name,
    version: String(library.version || '1.0'),
    description: library.description || framework.description || '',
    authority: library.provider || 'Unknown',
    source_url: `https://muraji-api.wathbahs.com/api/libraries/${library.id}`,
    image: null,
    repo_url: `muraji-library://${library.id}`,
    status: library.is_loaded ? 'imported' : null,
    type: 'Standard'
  };
}

/**
 * Convert a library to OpenGRC Standard with Controls format
 * This is the full import format that can be directly used by OpenGRC
 * @param {Object} library - The library object from database
 * @returns {Object} OpenGRC Standard format with controls array
 */
function convertToStandard(library) {
  if (!library) {
    return null;
  }

  const framework = library.content?.framework || {};
  const requirementNodes = framework.requirement_nodes || [];

  // Build parent-child map for hierarchy
  const nodeMap = new Map();
  requirementNodes.forEach(node => {
    nodeMap.set(node.urn, node);
  });

  // Extract controls (assessable nodes at depth 3 or leaf nodes)
  const controls = [];
  
  requirementNodes.forEach(node => {
    if (node.assessable === true) {
      // Find parent for category/type info
      const parent = node.parent_urn ? nodeMap.get(node.parent_urn) : null;
      const grandparent = parent?.parent_urn ? nodeMap.get(parent.parent_urn) : null;

      controls.push({
        code: node.ref_id,
        title: node.name || `Control ${node.ref_id}`,
        description: node.description || '',
        discussion: null,
        test: null,
        type: categorizeControlType(grandparent?.name || parent?.name || ''),
        category: parent?.name || grandparent?.name || 'General',
        enforcement: 'Mandatory'
      });
    }
  });

  return {
    code: library.ref_id || framework.ref_id || library.urn?.split(':').pop(),
    name: library.name || framework.name,
    authority: library.provider || 'Unknown',
    description: library.description || framework.description || '',
    controls: controls
  };
}

/**
 * Convert library to OpenGRC format based on output type
 * @param {Object} library - The library object from database
 * @param {string} outputType - 'bundle' or 'standard' (default: 'standard')
 * @returns {Object} Converted data in OpenGRC format
 */
function convertToOpenGRC(library, outputType = 'standard') {
  if (!library) {
    return null;
  }

  const framework = library.content?.framework || {};
  const requirementNodes = framework.requirement_nodes || [];

  // Build the response
  const response = {
    // Bundle metadata
    bundle: convertToBundle(library),
    
    // Full standard with controls (for direct import)
    standard: convertToStandard(library),
    
    // Metadata
    metadata: {
      source: 'muraji-api',
      library_id: library.id,
      library_urn: library.urn,
      original_provider: library.provider,
      version: library.version,
      locale: library.locale,
      total_requirement_nodes: requirementNodes.length,
      assessable_controls: requirementNodes.filter(n => n.assessable === true).length,
      converted_at: new Date().toISOString()
    }
  };

  // Return specific type if requested
  if (outputType === 'bundle') {
    return {
      success: true,
      format: 'opengrc-bundle',
      data: response.bundle,
      metadata: response.metadata
    };
  }

  if (outputType === 'standard') {
    return {
      success: true,
      format: 'opengrc-standard',
      data: response.standard,
      metadata: response.metadata
    };
  }

  // Return full response with both formats
  return {
    success: true,
    format: 'opengrc-full',
    data: response,
    metadata: response.metadata
  };
}

/**
 * Categorize control type based on domain/category name
 * @param {string} categoryName - The category or domain name
 * @returns {string} Control type
 */
function categorizeControlType(categoryName) {
  const name = (categoryName || '').toLowerCase();
  
  if (name.includes('governance') || name.includes('management') || name.includes('policy')) {
    return 'Administrative';
  }
  if (name.includes('technical') || name.includes('network') || name.includes('system') || name.includes('access')) {
    return 'Technical';
  }
  if (name.includes('physical') || name.includes('facility')) {
    return 'Physical';
  }
  if (name.includes('operational') || name.includes('ics') || name.includes('industrial')) {
    return 'Operational';
  }
  
  return 'Other';
}

/**
 * Extract hierarchy tree from library for display
 * @param {Object} library - The library object from database
 * @returns {Array} Hierarchical tree structure
 */
function extractHierarchy(library) {
  if (!library?.content?.framework?.requirement_nodes) {
    return [];
  }

  const nodes = library.content.framework.requirement_nodes;
  const nodeMap = new Map();
  const roots = [];

  // First pass: create node entries
  nodes.forEach(node => {
    nodeMap.set(node.urn, {
      ref_id: node.ref_id,
      name: node.name,
      description: node.description,
      depth: node.depth,
      assessable: node.assessable || false,
      children: []
    });
  });

  // Second pass: build hierarchy
  nodes.forEach(node => {
    const current = nodeMap.get(node.urn);
    if (node.parent_urn && nodeMap.has(node.parent_urn)) {
      nodeMap.get(node.parent_urn).children.push(current);
    } else if (node.depth === 1) {
      roots.push(current);
    }
  });

  return roots;
}

module.exports = {
  convertToBundle,
  convertToStandard,
  convertToOpenGRC,
  categorizeControlType,
  extractHierarchy
};
