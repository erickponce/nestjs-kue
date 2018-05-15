import 'reflect-metadata';
import { TASK_METADATA, TASK_CONFIGURATION_METADATA } from '../constants';


export interface TaskMetadata {
    name: string;
    queue?: string;
    concurrency?: number;
    priority?: string;
    ttl?: number;
    attempts?: number;
    backoff?: { (attempts: number, delay: number): number } | { delay?: number, type: string } | boolean;
}

export const Task = (metadata?: TaskMetadata | string): MethodDecorator => {
    return (target, key, descriptor: PropertyDescriptor) => {
        Reflect.defineMetadata(TASK_CONFIGURATION_METADATA, metadata, descriptor.value);
        Reflect.defineMetadata(TASK_METADATA, true, descriptor.value);
        return descriptor;
    };
};