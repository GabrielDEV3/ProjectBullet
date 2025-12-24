// weapon.js (inalterado - mas incluindo para referência)
class Weapon {
    constructor(id) {
        this.id = id;
        this.type = "none";
        this.px = 0.0;
        this.py = 0.0;
        this.pz = 0.0;
        this.rx = 0.0;
        this.ry = 0.0;
        this.rz = 0.0;
        this.content = {};
        this.parentId = null;
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            px: this.px,
            py: this.py,
            pz: this.pz,
            rx: this.rx,
            ry: this.ry,
            rz: this.rz,
            content: this.content,
            parentId: this.parentId
        };
    }

    fromJSON(json) {
        if (json.px !== undefined) this.px = json.px;
        if (json.py !== undefined) this.py = json.py;
        if (json.pz !== undefined) this.pz = json.pz;
        if (json.rx !== undefined) this.rx = json.rx;
        if (json.ry !== undefined) this.ry = json.ry;
        if (json.rz !== undefined) this.rz = json.rz;
        if (json.content !== undefined) this.content = json.content;
        return this;
    }
}

module.exports = Weapon;
