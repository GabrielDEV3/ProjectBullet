class Player {
    constructor(id) {
        this.id = id;
        this.name = "";

        this.rotX = 0;
        this.rotY = 0;
        this.posX = 0.0;
        this.posY = 0.0;
        this.posZ = 0.0;
        this.animationIndex = 0;

        this.slots = [];
        this.currentSlotIndex = 0;

        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.isAlive = true;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,

            rotX: this.rotX,
            rotY: this.rotY,
            posX: this.posX,
            posY: this.posY,
            posZ: this.posZ,
            animationIndex: this.animationIndex,

            slots: this.slots,
            currentSlotIndex: this.currentSlotIndex,

            health: this.health,
            maxHealth: this.maxHealth,
            isAlive: this.isAlive
        };
    }

    fromJSON(json) {
        //if (json.id !== undefined) this.id = json.id;
        if (json.name !== undefined) this.name = json.name;

        if (json.rotX !== undefined) this.rotX = json.rotX;
        if (json.rotY !== undefined) this.rotY = json.rotY;
        if (json.posX !== undefined) this.posX = json.posX;
        if (json.posY !== undefined) this.posY = json.posY;
        if (json.posZ !== undefined) this.posZ = json.posZ;
        if (json.animationIndex !== undefined) this.animationIndex = json.animationIndex;

        if (json.slots !== undefined) this.slots = json.slots;
        if (json.currentSlotIndex !== undefined) this.currentSlotIndex = json.currentSlotIndex;

        //if (json.health !== undefined) this.health = json.health;
        //if (json.maxHealth !== undefined) this.maxHealth = json.maxHealth;
        //if (json.isAlive !== undefined) this.isAlive = json.isAlive;
        return this;
    }

    hit(amount) {
        if (!this.isAlive) return false;

        this.health -= amount;
        if (this.health <= 0) {
            this.die();
            return true;
        }
        return false;
    }

    heal(amount) {
        if (!this.isAlive) return false;

        this.health = Math.min(this.maxHealth, this.health + amount);
        return true;
    }

    die() {
        this.isAlive = false;
        this.health = 0;
    }

    respawn(x, y, z) {
        this.isAlive = true;
        this.health = this.maxHealth;
        this.posX = x;
        this.posY = y;
        this.posZ = z;
        return true;
    }
}

module.exports = Player;