Deno.serve((_req: Request) => {
  return new Response(JSON.stringify({
    status: "ok",
    service: "mantiqatix-health",
    timestamp: new Date().toISOString(),
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
});
