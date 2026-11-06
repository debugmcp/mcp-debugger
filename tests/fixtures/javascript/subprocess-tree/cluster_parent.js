/**
 * A cluster primary with four workers (issue #1082): each worker is a
 * `cluster.fork()` js-debug reports on the primary's connection, so every
 * worker becomes a child session of the primary's; each ticks once on its
 * breakpoint and exits 0, and the primary exits once all four have.
 */
import cluster from 'node:cluster';

const WORKERS = 4;

if (cluster.isPrimary) {
  console.log('primary start');
  let exited = 0;
  cluster.on('exit', (worker, code) => {
    exited += 1;
    console.log(`primary worker ${worker.id} exit ${code}`);
    if (exited === WORKERS) {
      console.log('primary done');
      process.exit(0);
    }
  });
  for (let i = 0; i < WORKERS; i += 1) {
    cluster.fork();
  }
} else {
  const id = cluster.worker.id;
  console.log(`worker ${id} start`);
  setTimeout(() => {
    const marker = id; // BREAKPOINT
    console.log(`worker ${marker} done`);
    process.exit(0);
  }, 200);
}
