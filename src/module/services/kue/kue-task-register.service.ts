import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { TaskMetadataExplorer } from '../../task-metadata-explorer';
import { FancyLoggerService } from '../fancy-logger/fancy-logger.service';
import { KueService } from './kue.service';

export class InvalidModuleRefException extends Error {
    constructor() {
        super(`Invalid ModuleRef exception. Remember to set module reference "setModuleRef()".`);
    }
}

@Injectable()
export class KueTaskRegisterService {
    private moduleRef: ModuleRef = null;
    private readonly moduleName: string = 'KueModule';
    private readonly metadataExplorer: TaskMetadataExplorer;
    private readonly fancyLogger: FancyLoggerService;

    constructor(private readonly kueService: KueService) {
        this.metadataExplorer = new TaskMetadataExplorer(
            new MetadataScanner()
        );
        this.fancyLogger = new FancyLoggerService();
    }

    setModuleRef(moduleRef) {
        this.moduleRef = moduleRef;
    }

    register(tasks) {
        if (!this.moduleRef) {
            throw new InvalidModuleRefException();
        }

        const instance = this.moduleRef.get(tasks);
        if (!instance) return;

        this.createTasks(instance);
    }

    createTasks(instance) {
        for (const { task, metadata } of this.metadataExplorer.explore(instance)) {
            this.kueService.registerTask(task, metadata, instance);

            const desc: string = `Registered task ${metadata.name}`
                + `${(metadata.queue) ? ' on queue ' + metadata.queue : ''}`
                + `${(metadata.concurrency) ? ' with a concurrency of ' + metadata.concurrency : ''}`;
            this.fancyLogger.info(this.moduleName, desc, 'TaskExplorer');
        }
    }
}