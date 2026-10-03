import assert from "node:assert/strict";
import test from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getStorage,
  connectStorageEmulator,
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
} from "firebase/storage";

test(
  "Storage allows only the owner, rejects oversized attachments and supports deletion",
  { timeout: 60_000 },
  async () => {
    const endpoint = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    assert.ok(
      endpoint,
      "Start the local emulators with npm run test:firebase.",
    );
    const [host, port] = endpoint.split(":");
    assert.ok(["localhost", "127.0.0.1"].includes(host));
    const apps = [];
    const client = (uid) => {
      const app = initializeApp(
        {
          projectId: "demo-stepler-review",
          storageBucket: "demo-stepler-review.appspot.com",
          apiKey: "emulator-only",
        },
        `storage-${uid}`,
      );
      apps.push(app);
      const storage = getStorage(app);
      connectStorageEmulator(storage, host, Number(port), {
        mockUserToken: { sub: uid },
      });
      storage.maxOperationRetryTime = 1000;
      storage.maxUploadRetryTime = 1000;
      return storage;
    };
    try {
      const alice = client("alice"),
        bob = client("bob");
      const file = ref(alice, "users/alice/attachments/test.png");
      await uploadBytes(file, new Uint8Array([1, 2, 3]), {
        contentType: "image/png",
      });
      assert.deepEqual(
        new Uint8Array(await getBytes(file)),
        new Uint8Array([1, 2, 3]),
      );
      const denied = (promise) =>
        assert.rejects(
          promise,
          (error) => error.code === "storage/unauthorized",
        );
      await denied(getBytes(ref(bob, file.fullPath)));
      await denied(uploadBytes(ref(bob, file.fullPath), new Uint8Array([4])));
      await denied(deleteObject(ref(bob, file.fullPath)));
      await denied(
        uploadBytes(
          ref(alice, "users/alice/attachments/large.bin"),
          new Uint8Array(25 * 1024 * 1024),
        ),
      );
      await denied(
        uploadBytes(ref(alice, "unowned/file.png"), new Uint8Array([1])),
      );
      await deleteObject(file);
      await assert.rejects(
        getBytes(file),
        (error) => error.code === "storage/object-not-found",
      );
    } finally {
      await Promise.all(apps.map(deleteApp));
    }
  },
);
