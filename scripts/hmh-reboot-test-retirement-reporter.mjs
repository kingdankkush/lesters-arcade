export default async function* hmhRebootTestRetirementReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:fail' && event.type !== 'test:summary') continue;
    const data = event.data ?? {};
    yield `${JSON.stringify({
      type: event.type,
      name: data.name,
      file: data.file,
      nesting: data.nesting,
      detailsType: data.details?.type,
      success: data.success,
      counts: data.counts,
    })}\n`;
  }
}
