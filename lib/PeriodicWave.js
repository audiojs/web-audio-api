class PeriodicWave {
    constructor(real, imag){
        this.real = real
        this.imag = imag
        if(this.real.length != this.imag.length){
            throw new Error('INDEX_SIZE_ERR')
        }
    }
}

module.exports = PeriodicWave
