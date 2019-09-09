## Kue wrapper for NestJS framework

## Description

<p>Kue is a priority job queue backed by redis, built for nodeJS.</p> 
<p>This library provide facilities and utilities to use Kue with NestJS.</p>


## Installation

```bash
$ npm install --save nestjs-kue
```

**This module uses REDIS to operate, and utilizes the following environment variables and the default values as configurations:**

- KUE_REDIS_PREFIX  # Default 'q' 
- KUE_REDIS_HOST  # Default 'localhost'
- KUE_REDIS_PORT  # Default 6379
- KUE_REDIS_DB  # Default 0

As of 0.2.0 version, you are able to use connection URI using *KUE_REDIS_URI* variable like:

redis://example.com:1234?redis_option=value&redis_option=value


## Usage

**Defining tasks:**

<p>Tasks are defined in files like:<p/>

```
src/modules/users/tasks/users.tasks.ts
```

<p>You can define multiple tasks as a single injectable:</p>

```node
import { Injectable } from '@nestjs/common';
import { Job, JobCallback, DoneCallback } from 'kue';
import { Task } from 'nestjs-kue';

@Injectable()
export class UsersTasks {
    @Task({ name: 'justATest' })
    justATest(job: Job, done: DoneCallback) {
        const result: string = 'Ended just fine!';
        done(null, result);
    }
}
``` 

**Options when defining a task:**
```node
@Task({
    name: 'justATest',
    concurrency: 3,
    attempts: 3,
    ttl: 3000,
    backoff: { delay: 5 * 1000, type: 'fixed' }
})
```

**To setup the module, include KueModule and the KueTaskRegisterService in modules where you will use tasks, then register the tasks using the method register():**

```node
import { ModuleRef } from '@nestjs/core';
import { KueModule, KueTaskRegisterService } from 'nestjs-kue';
import { UsersTasks } from './tasks/users.tasks';

@Module({
  imports: [KueModule],
  controllers: [UsersController],
  providers: [UsersTasks],
})
export class UsersModule implements OnModuleInit {
    constructor(
        private readonly moduleRef: ModuleRef,
        private readonly taskRegister: KueTaskRegisterService
    ) {}

    onModuleInit() {
        this.taskRegister.setModuleRef(this.moduleRef);
        this.taskRegister.register(UsersTasks);
    }
}
```

**Firing a previously defined task:**
<p>Add the KueServive and the injectable with the task on your controller</p>

```node
import { Get, Controller } from '@nestjs/common';
import { UsersTasks } from './tasks/users.tasks';
import { KueService } from 'nestjs-kue';

@Controller()
export class AppController {
    constructor(
        private readonly kueService: KueService,
        private readonly tasks: UsersTasks
    ) {}
}
``` 

<p>Firing the task with { a: 'b' } as argument:</p>

```node
@Get('task')
createTask() {
    const job = this.kueService.createJob(this.tasks.justATest, { a: 'b' }).save();
}
```

**A task can emit some events when fired:**
<p>https://github.com/Automattic/kue#job-events</p>

```node
@Get('task')
createJob(@Res() res) {
    const job = this.kueService.createJob(this.tasks.justATest, { a: 'b' }).save();
    job.on('complete', (result) => res.send(result));
    job.on('failed', (err) => res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(err));
}
```

**For more options and details, please check Kue docs**
<p><a href="https://github.com/Automattic/kue" target="blank">Kue</a></p>

## Debug
**You can enable some debug logs with KUE_DEBUG environment variable:**

```node
KUE_DEBUG=true
```

## Kue daemon autostart
By default Kue daemon will start when you register one task. If you want to disable Kue Daemon on any process/container, set the KUE_START_PROCESSING environment variable:

```node
KUE_START_PROCESSING=false
```

## Redis sentinel configuration
This module support redis sentinel, you need to setup env variable like this

```node
# SENTINEL CONFIG
KUE_REDIS_SENTINEL=true
KUE_REDIS_SENTINEL_HOST=redis-sentinel-0,redis-sentinel-1,redis-sentinel-2 // NAME OF SENTINEL IN YOUR CLUSTER
KUE_REDIS_SENTINEL_PORT=26379,26379,26379 // PORT OF EACH SENTINEL IN YOUR CLUSTER
KUE_REDIS_SENTINEL_MASTER=name-of-master
```

You can set the `KUE_REDIS_SENTINEL` at **false** for disabled redis sentinel

## Datadog integration

**From version 0.3.0 and above, there are the ability to send execution stats to datadog monitoring service: [Datadog](https://www.datadoghq.com)**

To setup datadog, all you need to do is call the method `setDDTracer(tracer)` on `taskRegister` service with your Datadog `tracer` object as the parameter.

```node
this.taskRegister.setDDTracer(tracer);
```


## Kue UI
<p>It's possible to view info about tasks being executed with the default Kue UI</p>
<p>To enable it, set KUE_UI_ENABLED environment variable to true:</p>
<p>WARNING: The UI will be deployed using express!</p>

```node
KUE_UI_ENABLED=true 
```

<p>The default UI port is 3050, but if you like to change it use KUE_UI_PORT environment variable:</p>

```node
KUE_UI_PORT=3050
```

## People

- Author - [Erick Ponce Leão](https://github.com/erickponce)
