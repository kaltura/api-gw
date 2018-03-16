

class AAA {
    constructor() {
        console.log(this.constructor.name);
    }
}

class BBB extends AAA {
    constructor() {
        super();
    }
}

new AAA();
new BBB();