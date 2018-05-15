import { Module } from '@nestjs/common';
import { KueService } from './services/kue/kue.service';
import { KueTaskRegisterService } from './services/kue/kue-task-register.service';
import { FancyLoggerService } from './services/fancy-logger/fancy-logger.service';
import { TaskMetadataExplorer } from './task-metadata-explorer';
import { Controller } from '@nestjs/common/interfaces';
import * as kue from 'kue';
const express = require('express');

@Module({
    providers: [
        KueService,
        KueTaskRegisterService,
        FancyLoggerService,
    ],
    exports: [KueService, KueTaskRegisterService],
})
export class KueModule {
    private readonly name: string = 'KueModule';
    
    constructor(private readonly fancyLogger: FancyLoggerService) {
        if ((eval(process.env.KUE_UI_ENABLED) || false)) {
            const uiPort: number = parseInt(process.env.KUE_UI_PORT, null) || 3050;
            kue.app.listen(uiPort);
            this.fancyLogger.info(this.name, `Started on port ${uiPort}`, 'UI');
        }
    }
}