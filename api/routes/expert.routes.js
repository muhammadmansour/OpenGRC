/**
 * Expert Routes
 * Handles expert management endpoints
 */

const express = require('express');
const router = express.Router();
const expertService = require('../services/expert.service');
const { asyncHandler } = require('../middleware/error.middleware');

/**
 * @swagger
 * /api/experts:
 *   get:
 *     summary: Get all experts
 *     description: Retrieve list of all active experts or all experts including inactive
 *     tags: [Experts]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive experts
 *     responses:
 *       200:
 *         description: List of experts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Expert'
 */
router.get('/', asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;

  const experts = includeInactive === 'true'
    ? await expertService.getAllExpertsIncludingInactive()
    : await expertService.getAllExperts();

  res.json(experts);
}));

/**
 * @swagger
 * /api/experts/{id}:
 *   get:
 *     summary: Get expert by ID
 *     description: Retrieve a specific expert by their expert_id
 *     tags: [Experts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Expert ID (e.g., gca-auditor)
 *     responses:
 *       200:
 *         description: Expert details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Expert'
 *       404:
 *         description: Expert not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expert = await expertService.getExpertById(id);
  
  if (!expert) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Expert ${id} not found`
    });
  }

  res.json(expert);
}));

/**
 * @swagger
 * /api/experts/{id}/with-references:
 *   get:
 *     summary: Get expert with references
 *     description: Retrieve expert details along with all associated domain references
 *     tags: [Experts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Expert ID
 *     responses:
 *       200:
 *         description: Expert with references
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 expert:
 *                   $ref: '#/components/schemas/Expert'
 *                 references:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DomainReference'
 *       404:
 *         description: Expert not found
 */
router.get('/:id/with-references', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await expertService.getExpertWithReferences(id);
  
  if (!result) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Expert ${id} not found`
    });
  }

  res.json(result);
}));

/**
 * @swagger
 * /api/experts:
 *   post:
 *     summary: Create new expert
 *     description: Create a new expert profile
 *     tags: [Experts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - expert_id
 *               - name_ar
 *               - name_en
 *               - domain_id
 *             properties:
 *               expert_id:
 *                 type: string
 *                 example: new-expert
 *               name_ar:
 *                 type: string
 *                 example: خبير جديد
 *               name_en:
 *                 type: string
 *                 example: New Expert
 *               domain_id:
 *                 type: string
 *                 example: general
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Expert created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Expert'
 *       400:
 *         description: Validation error
 */
router.post('/', asyncHandler(async (req, res) => {
  const { expert_id, name_ar, name_en, domain_id } = req.body;

  if (!expert_id || !name_ar || !name_en || !domain_id) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'expert_id, name_ar, name_en, and domain_id are required'
    });
  }

  const expert = await expertService.createExpert(req.body);
  res.status(201).json(expert);
}));

/**
 * @swagger
 * /api/experts/{id}:
 *   put:
 *     summary: Update expert
 *     description: Update an existing expert's details
 *     tags: [Experts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Expert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name_ar:
 *                 type: string
 *               name_en:
 *                 type: string
 *               description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Expert updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Expert'
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const expert = await expertService.updateExpert(id, req.body);
  res.json(expert);
}));

/**
 * @swagger
 * /api/experts/{id}:
 *   delete:
 *     summary: Delete expert
 *     description: Delete an expert by ID
 *     tags: [Experts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Expert ID
 *     responses:
 *       200:
 *         description: Expert deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await expertService.deleteExpert(id);
  res.json({ success: true, message: `Expert ${id} deleted` });
}));

module.exports = router;
