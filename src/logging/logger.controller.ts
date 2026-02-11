// import { IsPublic } from '@decorators';
import { Controller, Post, Body } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { createReadStream, readdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

@Controller('log')
// @IsPublic()
export class LoggerController {
  @Post('backend')
  @ApiExcludeEndpoint()
  getLogs(@Body() body: any) {
    const { logs, year, month, date, file, search, page, limit } = body;

    const getDirectories = (source) =>
      readdirSync(source, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory() || dirent.isFile())
        .map((dirent) => dirent.name);

    let folders = getDirectories(join(process.cwd(), 'logs'));
    if (logs && year && month && date && file) {
      return this.paginateSearch(page, limit, join(process.cwd(), 'logs', 'logs', year, month, date, file), search);
    } else if (logs && year && month && date) {
      folders = getDirectories(join(process.cwd(), 'logs', 'logs', year, month, date));
    } else if (logs && year && month) {
      folders = getDirectories(join(process.cwd(), 'logs', 'logs', year, month));
    } else if (logs && year) {
      folders = getDirectories(join(process.cwd(), 'logs', 'logs', year));
    } else if (logs) {
      folders = getDirectories(join(process.cwd(), 'logs', 'logs'));
    }

    return folders;
  }

  async paginateSearch(qpage, qlimit, path, qsearch?) {
    const search = qsearch?.toLowerCase() || '';
    const page = parseInt(qpage) || 1;
    const limit = parseInt(qlimit) || 20;

    const fileStream = createReadStream(path);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let results: any[] = [];
    let finish: any[] = [];
    let matched = 0;
    let start = (page - 1) * limit;
    let end = start + limit;

    for await (const line of rl) {
      if (search && !line.toLowerCase().includes(search)) {
        continue;
      }
      results.push(line);
    }

    for (const line of results.reverse()) {
      if (matched >= start && matched < end) {
        finish.push(line);
      }
      matched++;

      if (matched >= end) break;
    }

    return {
      page,
      limit,
      total: matched,
      data: finish,
    };
  }
}
