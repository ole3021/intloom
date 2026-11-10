declare module "intloom:agent/*" {
  const agent: {
    readonly id: string;
    readonly description: string;
    readonly instructions: string;
  };
  export default agent;
}

declare module "intloom:skill/*" {
  const skill: import("@intloom/loom-sdk").SkillDefinition;
  export default skill;
}
