"""A parent that starts a multiprocessing child (issue #1081).

The spawn start method makes the child a fresh interpreter that debugpy
reports like any other Python child (spike notes: the same report, the child
stopping in work()).
"""
import multiprocessing
import sys


def work(n):
    total = n * 2  # BREAKPOINT
    print("mp work done %d" % total, flush=True)


if __name__ == "__main__":
    multiprocessing.set_start_method("spawn")
    proc = multiprocessing.Process(target=work, args=(21,))
    proc.start()
    proc.join()
    print("mp parent exit %d" % proc.exitcode, flush=True)
    sys.exit(proc.exitcode or 0)
