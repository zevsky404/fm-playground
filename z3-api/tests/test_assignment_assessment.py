
import json
import os

f = open(os.path.join(os.path.dirname(__file__),"test-cases.json"))
assignments = json.loads(f.read())
print(assignments)
