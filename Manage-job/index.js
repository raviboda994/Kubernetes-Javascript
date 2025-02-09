import { KubeConfig, CoreV1Api, BatchV1Api } from '@kubernetes/client-node';

// Load Kubernetes config
const kc = new KubeConfig();

// To get credentials from kubeconfig file
kc.loadFromDefault(); // Uses ~/.kube/config

// To get credentials from pod
// kc.loadFromCluster()

// To get credentials manually
// const TOKEN="Enter you api token here";
// const APISERVER = "https://nws-prod-dns-94zc9zpr.hcp.centralindia.azmk8s.io"
// const ServiceAccount = "nodejs-testing";
// const CLUSTER_NAME = "nws-prod";
// kc.loadFromOptions({
//     clusters: [{ name: CLUSTER_NAME, server: APISERVER, skipTLSVerify: true }],
//     users: [{ name: ServiceAccount, token: TOKEN }],
//     contexts: [{ name: 'service-account-context', cluster: CLUSTER_NAME, user: ServiceAccount }],
//     currentContext: 'service-account-context',
// });

const k8sApi = kc.makeApiClient(CoreV1Api);
const batchApi  = kc.makeApiClient(BatchV1Api);

async function listNamespaces() {
    try {
        const res = await k8sApi.listNamespace();

        console.log('Raw API Response:', JSON.stringify(res, null, 2)); // Debugging line

        if (!res || !res.items) {
            throw new Error('Invalid response from Kubernetes API');
        }

        console.log('Namespaces in the cluster:');
        res.items.forEach(ns => {
            console.log(ns.metadata.name);
        });
    } catch (error) {
        console.error('Error fetching namespaces:', error);
    }
}

// listNamespaces();


async function listPods(namespace) {
    try {
        const res = await k8sApi.listNamespacedPod({namespace});

        console.log(`Raw API Response for namespace '${namespace}':`, JSON.stringify(res, null, 2)); // Debugging line

        if (!res || !res.items) {
            throw new Error('Invalid response from Kubernetes API');
        }

        console.log(`Pods in namespace '${namespace}':`);
        res.items.forEach(pod => {
            console.log(pod.metadata.name);
        });
    } catch (error) {
        console.error(`Error fetching pods in namespace '${namespace}':`, error);
    }
}

// Change 'your-namespace' to the namespace you want to check
const namespace = 'nws-jobs-testing';
// listPods(namespace);



async function createJob(jobName,namespace) {
    const jobManifest = {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: { name: jobName, namespace },
        spec: {
            template: {
                metadata: { name: jobName },
                spec: {
                    containers: [
                        {
                            name: "job-container",
                            image: "busybox",
                            command: ["sh", "-c"],
                            args: [
                                'MESSAGES="Hello from Kubernetes!|Random message #1|Keep learning!|DevOps is awesome!|Stay motivated!|This is a test message"; ' +
                                'END=$(($(date +%s) + 60)); ' + // Get current UNIX time and add 60 seconds
                                'while [ $(date +%s) -lt $END ]; do ' +
                                'MSG=$(echo "$MESSAGES" | tr "|" "\n" | shuf -n 1); ' +
                                'echo "$MSG"; sleep 3; ' +
                                'done;'
                            ]
                        },
                    ],
                    restartPolicy: "Never",
                },
            },
            backoffLimit: 1, // Retry 3 times if the Job fails
        },
    };

    try {
        const res = await batchApi.createNamespacedJob({namespace, body: jobManifest});
        console.log(`✅ Job '${jobName}' created successfully.`);
        return res.body;
    } catch (error) {
        console.error("❌ Error creating Job:", error.body || error);
    }
}

async function getJobStatus(jobName,namespace) {
    try {
        const res = await batchApi.readNamespacedJobStatus({name:jobName, namespace: namespace});
        const status = res.status;

        console.log(`res`, res);
        console.log(`📊 Job '${jobName}' Status:`, status);
        if (status.failed) return "Failed";
        if (status.succeeded) return "Succeeded";
        return "Running";
    } catch (error) {
        console.error("❌ Error fetching Job status:", error.body || error);
    }
}

async function getPodName(jobName,namespace) {
    try {
        const podList = await k8sApi.listNamespacedPod({namespace});
        const jobPods = podList.items.filter(pod =>
            pod.metadata.ownerReferences?.some(ref => ref.kind === "Job" && ref.name === jobName)
        );

        if (jobPods.length === 0) {
            console.log("⚠️ No pods found for the Job yet. Retrying...");
            return null;
        }

        const podName = jobPods[0].metadata.name;
        console.log(`✅ Found Pod: ${podName}`);
        return podName;
    } catch (error) {
        console.error("❌ Error fetching Pods:", error.response?.body || error);
        return null;
    }
}

async function getPodLogs(name,namespace) {
    try {
        const logRes = await k8sApi.readNamespacedPodLog({name, namespace});
        console.log(`📜 Logs from Pod '${name}':\n${logRes}`);
        return logRes;
    } catch (error) {
        console.error("❌ Error fetching logs:", error.response?.body || error);
        return null;
    }
}

async function deleteJob(name, namespace) {
    try {
        await batchApi.deleteNamespacedJob({name, namespace, propagationPolicy: "Foreground"});
        console.log(`🗑️ Job '${name}' deleted successfully.`);
        return `🗑️ Job '${name}' deleted successfully.`
    } catch (error) {
        console.error("❌ Error deleting Job:", error.response?.body || error);
    }
}






// let res = await createJob("test-1",namespace)
// console.log("Response =>", res)
let res = await getJobStatus("test-1",namespace)
console.log("Response =>", res)

let podName = await getPodName("test-1",namespace)
console.log("podName =>", podName)
let res1 = await getPodLogs(podName,namespace)
console.log("Response =>", res1)
// let delres = await deleteJob("test-1",namespace)
// console.log("Response =>", delres)
