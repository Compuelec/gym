import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-2 p-6">
      <h1 className="text-2xl font-semibold">Gym</h1>
      <p className="text-muted-foreground">Entrena en casa o en el gimnasio.</p>
    </main>
  );
}
