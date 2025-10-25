import { Router, Request, Response } from 'express';
import mikrotikService from '../services/mikrotik.js';

export const terminalRoutes = Router();

/**
 * POST /api/terminal/execute
 * Execute a RouterOS command
 */
terminalRoutes.post('/execute', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Command is required'
      });
    }

    console.log(`Executing command: ${command}`);
    const startTime = Date.now();
    
    const output = await mikrotikService.executeTerminalCommand(command);
    const executionTime = Date.now() - startTime;
    
    res.json({
      command,
      output,
      timestamp: new Date().toISOString(),
      executionTime
    });
  } catch (error: any) {
    console.error('Error executing terminal command:', error);
    res.status(500).json({
      command: req.body.command,
      output: '',
      error: error.message || 'Command execution failed',
      timestamp: new Date().toISOString()
    });
  }
});
