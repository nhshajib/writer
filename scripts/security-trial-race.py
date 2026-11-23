import concurrent.futures
import subprocess
import uuid

def query(sql):
    return subprocess.check_output(["psql", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], text=True).strip()

owners = [str(uuid.uuid4()), str(uuid.uuid4())]
for i, owner in enumerate(owners):
    query(f"insert into auth.users values('{owner}', 'racefixture+{i}@gmail.com')")
def reserve(item):
    i, owner = item
    return query(f"select public.reserve_trial_checkout('racefixture+{i}@gmail.com', '{owner}')")
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(reserve, enumerate(owners)))
assert sorted(results) == ["available", "busy"], results
print("Concurrent alias checkout test passed: exactly one reservation.")
