import 'reflect-metadata';
import { Controller } from '@nestjs/common/interfaces/controllers/controller.interface';
import { isFunction, isUndefined } from '@nestjs/common/utils/shared.utils';
import { TASK_CONFIGURATION_METADATA, TASK_METADATA } from './constants';
import { TaskMetadata } from './utils/task.decorator';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';

export class TaskMetadataExplorer {
    constructor(private metadataScanner: MetadataScanner) {}

    public explore(instance: Controller): Array<TaskProperties> {
        const instancePrototype = Object.getPrototypeOf(instance);

        return this.metadataScanner.scanFromPrototype<Controller, TaskProperties>(
            instance,
            instancePrototype,
            (method) => this.exploreMethodMetadata(instance, instancePrototype, method),
        );
    }

     public exploreMethodMetadata(instance, instancePrototype, methodName: string): TaskProperties {
        const task = instancePrototype[methodName];
        const isTask = Reflect.getMetadata(TASK_METADATA, task);

        if (isUndefined(isTask)) return null;

        const metadata = Reflect.getMetadata(TASK_CONFIGURATION_METADATA, task);
        return {
            task,
            metadata,
        };
    }
}

export interface TaskProperties {
    task: (job, done) => void;
    metadata: TaskMetadata;
}
