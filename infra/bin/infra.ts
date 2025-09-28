#!/usr/bin/env node
import 'source-map-support/register';
// import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import * as gitBranch from 'git-branch';
import { CDKContext } from '../types';
import { KnowledgeBaseStack } from '../lib/init-stack';


const app = new cdk.App();

const currentBranch = process.env.AWS_BRANCH || gitBranch.sync();
// console.log(`Deploying on branch -> ${currentBranch}`);
const globals = app.node.tryGetContext('globals') || {}
// console.log(`Globals -> ${JSON.stringify(globals)}`);
const branchConfig = app.node.tryGetContext(currentBranch);
// console.log(`Branch config -> ${JSON.stringify(branchConfig)}`);

if(!branchConfig){
    throw new Error(`No configuration found for branch: ${currentBranch}`)
}

const context: CDKContext & cdk.StackProps = {
    branch: currentBranch,
    ...globals,
    ...branchConfig
}

// console.log(`Context -> ${JSON.stringify(context)}`);
// fs.writeFileSync('context.txt', JSON.stringify(context), 'utf8');

const appName = `${context.appName}-${context.stage}`
// const stackName = `${appName}-Stack`

new KnowledgeBaseStack(
    app, 
    `${appName}-KB-Stack`, 
    {
        stackName: `${appName}-KB-Stack`,
        env: context.env,
        description: 'This is a Knowledge Base Stack.',
        enableLocalhost: true,
    },
    context
) 


