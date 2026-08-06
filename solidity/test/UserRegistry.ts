import { expect } from "chai";
import { createHash, randomBytes } from "crypto";
import { ethers } from "hardhat";

function hashPassword(password: string, saltHex: string) {
  const salt = Buffer.from(saltHex.replace(/^0x/, ""), "hex");
  return `0x${createHash("sha256")
    .update(Buffer.concat([salt, Buffer.from(password)]))
    .digest("hex")}`;
}

describe("UserRegistry", function () {
  async function deployRegistry() {
    const [admin, alice, bob] = await ethers.getSigners();
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    const registry = await UserRegistry.deploy(admin.address);
    await registry.deployed();
    return { registry, admin, alice, bob };
  }

  it("registers a lowercase username to msg.sender", async function () {
    const { registry, alice } = await deployRegistry();
    const salt = `0x${randomBytes(32).toString("hex")}`;
    const passwordHash = hashPassword("secret123", salt);

    await expect(registry.connect(alice).register("alice", passwordHash, salt))
      .to.emit(registry, "UserRegistered")
      .withArgs("alice", alice.address);

    const account = await registry.getAccount("alice");
    expect(account.wallet).to.equal(alice.address);
    expect(account.passwordHash).to.equal(passwordHash);
    expect(await registry.userCount()).to.equal(1);
  });

  it("rejects duplicate usernames", async function () {
    const { registry, alice, bob } = await deployRegistry();
    const salt = `0x${randomBytes(32).toString("hex")}`;
    const passwordHash = hashPassword("secret123", salt);

    await registry.connect(alice).register("alice", passwordHash, salt);

    await expect(
      registry.connect(bob).register("alice", passwordHash, salt)
    ).to.be.revertedWith("UserRegistry: username taken");
  });

  it("lets admin rebind a wallet", async function () {
    const { registry, admin, alice, bob } = await deployRegistry();
    const salt = `0x${randomBytes(32).toString("hex")}`;
    const passwordHash = hashPassword("secret123", salt);

    await registry.connect(alice).register("alice", passwordHash, salt);
    await registry.connect(admin).adminUpdateWallet("alice", bob.address);

    const account = await registry.getAccount("alice");
    expect(account.wallet).to.equal(bob.address);
  });
});
