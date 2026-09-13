export function registerGameTools(actions, context = document.modelContext) {
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const tools=[
    {name:'read_math_expedition',description:'Read the visible task, lives and unlocked level without revealing the expected answer.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>actions.read()},
    {name:'start_math_level',description:'Start an unlocked math level from the map or result screen. Creates a new attempt.',inputSchema:{type:'object',properties:{levelId:{type:'integer',minimum:1,maximum:30}},required:['levelId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||!Number.isInteger(input.levelId)||input.levelId<1||input.levelId>30)throw new Error('Invalid level');return actions.start(input.levelId);}}
  ];
  for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional proposed API; gameplay does not depend on it. */}}
  return ()=>lifecycle.abort();
}
