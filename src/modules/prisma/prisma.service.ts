import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { DATABASE_URL } from 'src/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: { url: DATABASE_URL },
      },
    });
  }
  private readonly maxRetries = 10; // Qayta urinish maksimal soni
  private readonly retryDelay = 1500; // Qayta urinish orasidagi kutish vaqti (ms)

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  public async handleDisconnect() {
    await this.$disconnect();
    await this.connectWithRetry();
  }

  private async connectWithRetry() {
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        await this.$connect();
        console.log('Prisma client successfully connected to the database.');
        return;
      } catch (error) {
        retries++;
        console.error(`Prisma client connection attempt ${retries} failed.`);
        // if([3, 6, 9].includes(retries)) this.exec()
        if (retries >= this.maxRetries) {
          console.error('Max retries reached. Could not connect to the database.');
        }
        await this.delay(this.retryDelay);
      }
    }
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private exec() {
    exec('sudo systemctl restart postgresql', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return;
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
    });
  }
}
