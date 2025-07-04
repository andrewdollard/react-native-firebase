import {
  setLogLevel,
  connectFirestoreEmulator,
  initializeFirestore,
  runTransaction,
  getApp,
  getFirestore,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  getCount,
  getAggregate,
  count,
  average,
  sum,
  deleteDoc,
  setDoc,
  updateDoc,
  writeBatch,
  terminate,
} from '@react-native-firebase/app/lib/internal/web/firebaseFirestore';
import { guard, getWebError, emitEvent } from '@react-native-firebase/app/lib/internal/web/utils';
import { objectToWriteable, readableToObject, parseDocumentBatches } from './convert';
import { buildQuery } from './query';

function rejectWithCodeAndMessage(code, message) {
  return Promise.reject(
    getWebError({
      code,
      message,
    }),
  );
}

// Converts a Firestore document snapshot to a plain object.
function documentSnapshotToObject(snapshot) {
  const exists = snapshot.exists();

  const out = {
    metadata: [false, false], // lite SDK doesn't return metadata
    path: snapshot.ref.path,
    exists,
  };

  if (exists) {
    out.data = objectToWriteable(snapshot.data() || {});
  }

  return out;
}

// Converts a Firestore query snapshot to a plain object.
function querySnapshotToObject(snapshot) {
  return {
    source: 'get',
    excludesMetadataChanges: true, // lite SDK doesn't return metadata changes
    changes: [],
    metadata: [false, false], // lite SDK doesn't return metadata
    documents: snapshot.docs.map(documentSnapshotToObject),
  };
}

const emulatorForApp = {};
const firestoreInstances = {};
const appInstances = {};
const transactionHandler = {};
const transactionBuffer = {};

function getCachedAppInstance(appName) {
  return (appInstances[appName] ??= getApp(appName));
}

function createFirestoreKey(appName, databaseId) {
  return `${appName}:${databaseId}`;
}

// Returns a cached Firestore instance.
function getCachedFirestoreInstance(appName, databaseId) {
  const firestoreKey = createFirestoreKey(appName, databaseId);
  let instance = firestoreInstances[firestoreKey];
  if (!instance) {
    instance = getFirestore(getCachedAppInstance(appName), databaseId);
    if (emulatorForApp[firestoreKey]) {
      connectFirestoreEmulator(
        instance,
        emulatorForApp[firestoreKey].host,
        emulatorForApp[firestoreKey].port,
      );
    }
    firestoreInstances[firestoreKey] = instance;
  }
  return instance;
}

export default {
  /**
   * Sets the log level for Firestore.
   * @param {string} logLevel - The log level.
   */
  async setLogLevel(logLevel) {
    if (logLevel === 'debug' || logLevel === 'error') {
      setLogLevel(logLevel);
    } else {
      setLogLevel('silent');
    }
  },

  loadBundle() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  clearPersistence() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  /**
   * Waits for all pending writes to be acknowledged by the backend.
   * Noop in the lite SDK.
   * @returns {Promise<null>} An empty promise.
   */
  async waitForPendingWrites() {
    return null;
  },

  disableNetwork() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  enableNetwork() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  addSnapshotsInSync() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  removeSnapshotsInSync() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  /**
   * Use the Firestore emulator.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} host - The emulator host.
   * @param {number} port - The emulator port.
   * @returns {Promise<null>} An empty promise.
   */
  useEmulator(appName, databaseId, host, port) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      connectFirestoreEmulator(firestore, host, port);
      const firestoreKey = createFirestoreKey(appName, databaseId);
      emulatorForApp[firestoreKey] = { host, port };
    });
  },

  /**
   * Initializes a Firestore instance with settings.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {object} settings - The Firestore settings.
   * @returns {Promise<null>} An empty promise.
   */
  settings(appName, databaseId, settings) {
    return guard(() => {
      const instance = initializeFirestore(getCachedAppInstance(appName), settings, databaseId);
      firestoreInstances[appName] = instance;
    });
  },

  /**
   * Terminates a Firestore instance.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @returns {Promise<null>} An empty promise.
   */
  terminate(appName, databaseId) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      await terminate(firestore);
      return null;
    });
  },

  // Collection
  namedQueryOnSnapshot() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  collectionOnSnapshot() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  collectionOffSnapshot() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  namedQueryGet() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  /**
   * Get a collection count from Firestore.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} path - The collection path.
   * @param {string} type - The collection type (e.g. collectionGroup).
   * @param {object[]} filters - The collection filters.
   * @param {object[]} orders - The collection orders.
   * @param {object} options - The collection options.
   * @returns {Promise<object>} The collection count object.
   */
  collectionCount(appName, databaseId, path, type, filters, orders, options) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const queryRef =
        type === 'collectionGroup' ? collectionGroup(firestore, path) : collection(firestore, path);
      const query = buildQuery(queryRef, filters, orders, options);
      const snapshot = await getCount(query);

      return {
        count: snapshot.data().count,
      };
    });
  },

  aggregateQuery(appName, databaseId, path, type, filters, orders, options, aggregateQueries) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const queryRef =
        type === 'collectionGroup' ? collectionGroup(firestore, path) : collection(firestore, path);
      const query = buildQuery(queryRef, filters, orders, options);
      const aggregateSpec = {};

      for (let i = 0; i < aggregateQueries.length; i++) {
        const aggregateQuery = aggregateQueries[i];
        const { aggregateType, field, key } = aggregateQuery;

        switch (aggregateType) {
          case 'count':
            aggregateSpec[key] = count();
            break;
          case 'average':
            aggregateSpec[key] = average(field);
            break;
          case 'sum':
            aggregateSpec[key] = sum(field);
            break;
        }
      }
      const result = await getAggregate(query, aggregateSpec);

      const data = result.data();
      const response = {};
      for (let i = 0; i < aggregateQueries.length; i++) {
        const aggregateQuery = aggregateQueries[i];
        const { key } = aggregateQuery;
        response[key] = data[key];
      }

      return response;
    });
  },

  /**
   * Get a collection from Firestore.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} path - The collection path.
   * @param {string} type - The collection type (e.g. collectionGroup).
   * @param {object[]} filters - The collection filters.
   * @param {object[]} orders - The collection orders.
   * @param {object} options - The collection options.
   * @param {object} getOptions - The get options.
   * @returns {Promise<object>} The collection object.
   */
  collectionGet(appName, databaseId, path, type, filters, orders, options, getOptions) {
    if (getOptions && getOptions.source === 'cache') {
      return rejectWithCodeAndMessage(
        'unsupported',
        'The source cache is not supported in the lite SDK.',
      );
    }

    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const queryRef =
        type === 'collectionGroup' ? collectionGroup(firestore, path) : collection(firestore, path);
      const query = buildQuery(queryRef, filters, orders, options);
      const snapshot = await getDocs(query);
      return querySnapshotToObject(snapshot);
    });
  },

  // Document
  documentOnSnapshot() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  documentOffSnapshot() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  persistenceCacheIndexManager() {
    return rejectWithCodeAndMessage('unsupported', 'Not supported in the lite SDK.');
  },

  /**
   * Get a document from Firestore.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} path - The document path.
   * @param {object} getOptions - The get options.
   * @returns {Promise<object>} The document object.
   */
  documentGet(appName, databaseId, path, getOptions) {
    return guard(async () => {
      if (getOptions && getOptions.source === 'cache') {
        return rejectWithCodeAndMessage(
          'unsupported',
          'The source cache is not supported in the lite SDK.',
        );
      }

      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const ref = doc(firestore, path);
      const snapshot = await getDoc(ref);
      return documentSnapshotToObject(snapshot);
    });
  },

  /**
   * Delete a document from Firestore.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} path - The document path.
   * @returns {Promise<null>} An empty promise.
   */
  documentDelete(appName, databaseId, path) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const ref = doc(firestore, path);
      await deleteDoc(ref);
      return null;
    });
  },

  /**
   * Set a document in Firestore.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} path - The document path.
   * @param {object} data - The document data.
   * @param {object} options - The set options.
   * @returns {Promise<null>} An empty promise.
   */
  documentSet(appName, databaseId, path, data, options) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const ref = doc(firestore, path);
      const setOptions = {};
      if ('merge' in options) {
        setOptions.merge = options.merge;
      } else if ('mergeFields' in options) {
        setOptions.mergeFields = options.mergeFields;
      }
      await setDoc(ref, readableToObject(firestore, data), setOptions);
    });
  },

  /**
   * Update a document in Firestore.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} path - The document path.
   * @param {object} data - The document data.
   * @returns {Promise<null>} An empty promise.
   */
  documentUpdate(appName, databaseId, path, data) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const ref = doc(firestore, path);
      await updateDoc(ref, readableToObject(firestore, data));
    });
  },

  /**
   * Batch write documents in Firestore.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {object[]} writes - The document writes in write batches format.
   */
  documentBatch(appName, databaseId, writes) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const batch = writeBatch(firestore);
      const writesArray = parseDocumentBatches(firestore, writes);

      for (const parsed of writesArray) {
        const { type, path } = parsed;
        const ref = doc(firestore, path);

        switch (type) {
          case 'DELETE':
            batch.delete(ref);
            break;
          case 'UPDATE':
            batch.update(ref, parsed.data);
            break;
          case 'SET':
            const options = parsed.options;
            const setOptions = {};
            if ('merge' in options) {
              setOptions.merge = options.merge;
            } else if ('mergeFields' in options) {
              setOptions.mergeFields = options.mergeFields;
            }
            batch.set(ref, parsed.data, setOptions);
            break;
        }
      }

      await batch.commit();
    });
  },

  /**
   * Get a document from a Firestore transaction.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} transactionId - The transaction id.
   * @param {string} path - The document path.
   * @returns {Promise<object>} The document object.
   */
  transactionGetDocument(appName, databaseId, transactionId, path) {
    if (!transactionHandler[transactionId]) {
      return rejectWithCodeAndMessage(
        'internal-error',
        'An internal error occurred whilst attempting to find a native transaction by id.',
      );
    }

    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);
      const docRef = doc(firestore, path);
      const tsx = transactionHandler[transactionId];
      const snapshot = await tsx.get(docRef);
      return documentSnapshotToObject(snapshot);
    });
  },

  /**
   * Dispose a transaction instance.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} transactionId - The transaction id.
   */
  transactionDispose(_appName, _databaseId, transactionId) {
    // There's no abort method in the JS SDK, so we just remove the transaction handler.
    delete transactionHandler[transactionId];
  },

  /**
   * Applies a buffer of commands to a Firestore transaction.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} transactionId - The transaction id.
   * @param {object[]} commandBuffer - The readable array of buffer commands.
   */
  transactionApplyBuffer(_appName, _databaseId, transactionId, commandBuffer) {
    if (transactionHandler[transactionId]) {
      transactionBuffer[transactionId] = commandBuffer;
    }
  },

  /**
   * Begins a Firestore transaction.
   * @param {string} appName - The app name.
   * @param {string} databaseId - The database ID.
   * @param {string} transactionId - The transaction id.
   * @returns {Promise<null>} An empty promise.
   */
  transactionBegin(appName, databaseId, transactionId) {
    return guard(async () => {
      const firestore = getCachedFirestoreInstance(appName, databaseId);

      try {
        await runTransaction(firestore, async tsx => {
          transactionHandler[transactionId] = tsx;

          emitEvent('firestore_transaction_event', {
            eventName: 'firestore_transaction_event',
            body: { type: 'update' },
            appName,
            databaseId,
            listenerId: transactionId,
          });

          function getBuffer() {
            return transactionBuffer[transactionId];
          }

          // Wait for and get the stored buffer array for the transaction.
          const buffer = await new Promise(resolve => {
            const interval = setInterval(() => {
              const buffer = getBuffer();
              if (buffer) {
                clearInterval(interval);
                resolve(buffer);
              }
            }, 100);
          });

          for (const serialized of buffer) {
            const { path, type, data } = serialized;
            const docRef = doc(firestore, path);

            switch (type) {
              case 'DELETE':
                tsx.delete(docRef);
                break;
              case 'UPDATE':
                tsx.update(docRef, readableToObject(firestore, data));
                break;
              case 'SET':
                const options = serialized.options;
                const setOptions = {};
                if ('merge' in options) {
                  setOptions.merge = options.merge;
                } else if ('mergeFields' in options) {
                  setOptions.mergeFields = options.mergeFields;
                }
                tsx.set(docRef, readableToObject(firestore, data), setOptions);
                break;
            }
          }
        });

        emitEvent('firestore_transaction_event', {
          eventName: 'firestore_transaction_event',
          body: { type: 'complete' },
          appName,
          databaseId,
          listenerId: transactionId,
        });
      } catch (e) {
        emitEvent('firestore_transaction_event', {
          eventName: 'firestore_transaction_event',
          body: { type: 'error', error: getWebError(e) },
          appName,
          databaseId,
          listenerId: transactionId,
        });
      }
    });
  },
};
