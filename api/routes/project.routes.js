/**
 * Project Routes
 * Handles audit project management endpoints
 */

const express = require('express');
const router = express.Router();
const projectService = require('../services/project.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create new project
 *     description: Create a new audit project
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - expert_type
 *               - domain_id
 *             properties:
 *               name:
 *                 type: string
 *                 example: مشروع تدقيق جديد
 *               expert_type:
 *                 type: string
 *                 example: gca-auditor
 *               domain_id:
 *                 type: string
 *                 example: general
 *               description:
 *                 type: string
 *               selected_standards:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Validation error
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;
  const { name, expert_type, domain_id } = req.body;

  if (!name || !expert_type || !domain_id) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'name, expert_type, and domain_id are required'
    });
  }

  const project = await projectService.createProject(req.body, userId);
  res.status(201).json(project);
}));

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     description: Get all audit projects for the authenticated user
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.userId || req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'User ID not found'
    });
  }

  const projects = await projectService.getAllProjects(userId);
  res.json(projects);
}));

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     description: Retrieve a specific project by its UUID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project UUID
 *     responses:
 *       200:
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: Project not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || req.user?.id;

  const project = await projectService.getProject(id, userId);
  
  if (!project) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Project ${id} not found`
    });
  }

  res.json(project);
}));

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update project
 *     description: Update an existing project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || req.user?.id;

  const project = await projectService.updateProject(id, req.body, userId);
  res.json(project);
}));

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete project
 *     description: Delete a project by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project UUID
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || req.user?.id;

  await projectService.deleteProject(id, userId);
  res.json({ success: true, message: `Project ${id} deleted` });
}));

/**
 * @swagger
 * /api/projects/{id}/analyses:
 *   get:
 *     summary: Get project analyses
 *     description: Get all standard analyses for a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project UUID
 *     responses:
 *       200:
 *         description: List of analyses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   standard_id:
 *                     type: string
 *                   status:
 *                     type: string
 *                   score:
 *                     type: number
 */
router.get('/:id/analyses', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const analyses = await projectService.getStandardAnalyses(id);
  res.json(analyses);
}));

/**
 * @swagger
 * /api/projects/{id}/analyses:
 *   post:
 *     summary: Save standard analysis
 *     description: Save or update a standard analysis for a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - standardId
 *             properties:
 *               standardId:
 *                 type: string
 *               standardNameAr:
 *                 type: string
 *               standardNameEn:
 *                 type: string
 *               analysisResult:
 *                 type: object
 *               score:
 *                 type: number
 *               complianceLevel:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, analyzing, completed, error]
 *     responses:
 *       200:
 *         description: Analysis saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post('/:id/analyses', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { standardId, standardNameAr, standardNameEn, analysisResult, rawResponse, score, complianceLevel, status } = req.body;

  if (!standardId) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'standardId is required'
    });
  }

  await projectService.saveStandardAnalysis({
    projectId: id,
    standardId,
    standardNameAr,
    standardNameEn,
    analysisResult,
    rawResponse,
    score,
    complianceLevel,
    status
  });

  res.json({ success: true });
}));

/**
 * @swagger
 * /api/projects/{id}/status:
 *   get:
 *     summary: Get audit status
 *     description: Get calculated audit status for a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project UUID
 *     responses:
 *       200:
 *         description: Audit status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: مكتمل
 */
router.get('/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const status = await projectService.calculateAuditStatus(id);
  res.json({ status });
}));

/**
 * @swagger
 * /api/projects/{id}/update-status:
 *   put:
 *     summary: Update project status
 *     description: Recalculate and update project status based on analyses
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project UUID
 *     responses:
 *       200:
 *         description: Updated project
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 */
router.put('/:id/update-status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId || req.user?.id;

  const project = await projectService.updateProjectStatusFromAnalyses(id, userId);
  res.json(project);
}));

module.exports = router;
