import { Injectable } from '@nestjs/common';
import * as clc from 'cli-color';

@Injectable()
export class FancyLoggerService {
    static clc = clc;
    
    private static getModule(module: string): string {
        return `${this.clc.green('[' + module + ']    - ')}`;
    }

    private static getScope(scope: string): string {
        return `   [${scope}]`;
    }

    private static getTime(): string {
        return `${this.clc.magenta(new Date().toLocaleString())}`;
    }

    private static getText(message: string): string {
        return ` ${this.clc.green(message)}`;
    }

    info(moduleName: string, message: string, scope?: string) {
        let log: string = `${FancyLoggerService.getModule(moduleName)}`
            + `${FancyLoggerService.getTime()}`
            + `${(scope) ? FancyLoggerService.getScope(scope) : ''}`
            + `${FancyLoggerService.getText(message)}`;

        console.info(log);
    }
}
