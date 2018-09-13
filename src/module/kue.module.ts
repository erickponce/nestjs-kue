import { Module } from '@nestjs/common';
import { KueService } from './services/kue/kue.service';
import { KueTaskRegisterService } from './services/kue/kue-task-register.service';
import { FancyLoggerService } from './services/fancy-logger/fancy-logger.service';
import { TaskMetadataExplorer } from './task-metadata-explorer';
import { Controller } from '@nestjs/common/interfaces';
const express = require('express');

@Module({
    providers: [
        KueService,
        KueTaskRegisterService,
        FancyLoggerService,
    ],
    exports: [KueService, KueTaskRegisterService],
})
export class KueModule {}