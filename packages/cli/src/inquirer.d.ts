declare module 'inquirer' {
  interface PromptModule {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (questions: any[]): Promise<any>;
  }
  interface InquirerStatic {
    createPromptModule(): PromptModule;
  }
  const inquirer: InquirerStatic;
  export default inquirer;
}
