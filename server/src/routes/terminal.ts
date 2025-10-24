import { Router, Request, Response } from 'express';

const router = Router();

// Execute command (mock implementation)
router.post('/execute', (req: Request, res: Response) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({
      error: 'Command is required'
    });
  }

  // Mock command responses
  let output = '';
  const cmd = command.toLowerCase();

  if (cmd.includes('/system resource print')) {
    output = `uptime: 15d7h23m45s
version: 7.11 (stable)
cpu-load: 23%
free-memory: 1200MiB
total-memory: 2048MiB`;
  } else if (cmd.includes('/interface print')) {
    output = `Flags: X - disabled, R - running
 #   NAME            TYPE       ACTUAL-MTU
 0 R ether1-gateway  ether      1500
 1 R ether2-local    ether      1500
 2   ether3          ether      1500
 3 R wlan1           wlan       1500`;
  } else if (cmd.includes('/ip address print')) {
    output = ` #   ADDRESS         NETWORK       INTERFACE
 0   192.168.88.1/24 192.168.88.0  ether2-local
 1   10.0.0.1/24     10.0.0.0      ether1-gateway`;
  } else {
    output = `bad command name ${command.split(' ')[0]} (line 1 column 1)`;
  }

  res.json({
    command,
    output,
    timestamp: new Date().toISOString()
  });
});

export { router as terminalRoutes };
