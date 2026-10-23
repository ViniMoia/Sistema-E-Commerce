"""Read-only, sanitized GCP metadata. No secret access or workload HTTP requests."""
import concurrent.futures
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import urllib.parse
import urllib.request

PROJECT = 'continental-511812'
REGION = 'southamerica-east1'
BASE = f'https://run.googleapis.com/v2/projects/{PROJECT}/locations/{REGION}'
FLAGS = ['APP_MAINTENANCE_MODE', 'CHECKOUT_PAUSED', 'PAYMENT_WORKER_ENABLED',
         'PAYMENT_REMOTE_ENABLED', 'PAYMENT_EXPIRATION_ENABLED',
         'PAYMENT_DEPLOYMENT_ENVIRONMENT', 'ASAAS_ACCOUNT_SCOPE']


def collect():
    gcloud = shutil.which('gcloud') or str(pathlib.Path(os.environ['LOCALAPPDATA']) /
        'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd')
    token = subprocess.run([gcloud, 'auth', 'print-access-token', '--project=' + PROJECT,
        '--billing-project=' + PROJECT, '--quiet'], capture_output=True, text=True, check=True).stdout.strip()

    def api(url):
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token,
            'x-goog-user-project': PROJECT})
        with urllib.request.urlopen(req, timeout=40) as response:
            return json.load(response)

    def paged(url, key):
        rows = []
        while True:
            result = api(url)
            rows.extend(result.get(key, []))
            if not result.get('nextPageToken'):
                return rows
            url = url.split('&pageToken=')[0] + ('&' if '?' in url else '?') + 'pageToken=' + urllib.parse.quote(result['nextPageToken'])

    def environment(container):
        entries = {entry['name']: entry for entry in container.get('env', [])}
        return {'flags': {key: entries.get(key, {}).get('value') for key in FLAGS},
                'secretBindings': {key: entry['valueSource'] for key, entry in entries.items() if 'valueSource' in entry}}

    def job(name):
        value = api(BASE + '/jobs/' + name)
        task = value['template']['template']
        container = task['containers'][0]
        safe = environment(container)
        literals = {entry['name']: entry.get('value') for entry in container.get('env', [])}
        safe.update({key: literals.get(key) for key in ['CONSUMER_ORIGIN', 'CONSUMER_MODE', 'CONSUMER_MAX_BATCHES', 'CONSUMER_REQUEST_TIMEOUT_MS']})
        return {'name': name, 'timeout': task.get('timeout'), 'maxRetries': task.get('maxRetries', 0),
            'taskCount': value['template'].get('taskCount', 1), 'parallelism': value['template'].get('parallelism', 1),
            'executionCount': value.get('executionCount', 0),
            'listedExecutions': len(paged(BASE + '/jobs/' + name + '/executions?pageSize=100', 'executions')),
            'command': container.get('command'), 'args': container.get('args'), **safe}

    start = datetime.datetime.now(datetime.timezone.utc).isoformat()
    service = api(BASE + '/services/continental-hml')
    template = service['template']
    traffic = service.get('trafficStatuses', [])
    revision_names = sorted({item['revision'] for item in traffic})
    def revision(name):
        value = api(BASE + '/services/continental-hml/revisions/' + name)
        return {'name': name, 'timeout': value.get('timeout'), 'scaling': value.get('scaling'),
                'maxInstanceRequestConcurrency': value.get('maxInstanceRequestConcurrency'),
                'resources': value['containers'][0].get('resources'), **environment(value['containers'][0])}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        revisions = list(executor.map(revision, revision_names))
        jobs = list(executor.map(job, ['continental-hml-payments', 'continental-hml-supervision']))
    metrics = paged(f'https://logging.googleapis.com/v2/projects/{PROJECT}/metrics?pageSize=100', 'metrics')
    policies = paged(f'https://monitoring.googleapis.com/v3/projects/{PROJECT}/alertPolicies?pageSize=100', 'alertPolicies')
    channels = paged(f'https://monitoring.googleapis.com/v3/projects/{PROJECT}/notificationChannels?pageSize=100', 'notificationChannels')
    return {'startedAt': start, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'readOnly': True, 'secretValuesAccessed': False, 'project': PROJECT, 'region': REGION,
        'service': {'traffic': traffic, 'timeout': template.get('timeout'), 'scaling': template.get('scaling'),
                    **environment(template['containers'][0])}, 'reachableRevisions': revisions, 'jobs': jobs,
        'metrics': [{'name': row['name'], 'filter': row.get('filter')} for row in metrics],
        'policies': [{'name': row['name'], 'displayName': row['displayName'], 'enabled': row.get('enabled'),
                     'conditions': row.get('conditions')} for row in policies],
        'channels': [{'name': row['name'], 'type': row.get('type'), 'enabled': row.get('enabled')} for row in channels]}


if __name__ == '__main__':
    directory = pathlib.Path('artifacts/operational-readiness/inventory')
    directory.mkdir(parents=True, exist_ok=True)
    try:
        result = collect()
        target = directory / ('gcp-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
        print(json.dumps({'ok': True, 'path': str(target)}))
    except Exception as error:
        # Never print subprocess output, access tokens or API response bodies.
        print(json.dumps({'ok': False, 'errorType': type(error).__name__}))
        raise SystemExit(1) from None
