
import json
import os

f = open(os.path.join(os.path.dirname(__file__), "test-cases-assessment.json"))
assignments = json.loads(f.read())['test-cases'][0]
print(assignments)
