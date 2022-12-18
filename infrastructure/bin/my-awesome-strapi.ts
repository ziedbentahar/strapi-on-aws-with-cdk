#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { StrapiStack } from "../lib/strapi";

const app = new cdk.App({
  context: {
    applicationName: "strapi",
    hostedZoneDomainName: "inflow-it-labs.tk",
  },
});
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new StrapiStack(app, StrapiStack.name, { stackName: StrapiStack.name, env });