import { createApp } from './app.js';
import { config } from './config/environment.js';
import { prisma } from './config/database.js';

const app = createApp();

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to PostgreSQL database.');

    const server = app.listen(config.port, () => {
      console.log(`QUBEXE SALOON SOFTWARE Backend server is running on http://localhost:${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Database disconnected. Process terminated.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
