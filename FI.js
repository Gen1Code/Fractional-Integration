import { CompositeCost, CustomCost, ExponentialCost, FirstFreeCost, LinearCost } from "./api/Costs";
import { Localization } from "./api/Localization";
import { parseBigNumber, BigNumber } from "./api/BigNumber";
import { theory } from "./api/Theory";
import { Utils } from "./api/Utils";

var id = "fractional_integration";
var name = "Fractional Integration";
var description = "not null";
var authors = "Sneaky (SnaekySnacks#1161) - Idea\nGen (Gen#3006) - Coding";
var version = 1.0;
var releaseOrder = "1";

var rho_dot = BigNumber.ZERO;
var t_cumulative = BigNumber.ZERO;

// lambda = 1 - 1/2^k
// lambda = 1 - 1/lambda_helper
// lambda = 1 - `lambda_man`e`lambda_exp` 

// 1/2^k in xxxe-xxx form
//man =  10^((log(1)-k*log(2)) - exp)
//exp = floor(log(1) - k*log(2))

var lambda_helper = BigNumber.ONE;

var lambda_man = BigNumber.ZERO;
var lambda_exp = BigNumber.ZERO;

var update_divisor = false;

var q1, q2, t, k;
var q1Exp;

var init = () => {
    currency = theory.createCurrency();

    ///////////////////
    // Regular Upgrades
    
    //t
    {
        let getDesc = (level) => "\\dot{t}=" + getT(level).toString(1);
        let getInfo = (level) => "\\dot{t}=" + getT(level).toString(1);
        t = theory.createUpgrade(0, currency, new ExponentialCost(1e10, Math.log2(1e15)));
        t.getDescription = (amount) => Utils.getMath(getDesc(t.level));
        t.getInfo = (amount) => Utils.getMathTo(getInfo(t.level), getInfo(t.level + amount));
        t.maxLevel=4;
    }

    // q1
    {
        let getDesc = (level) => "q_1=" + getQ1(level).toString(0);
        let getInfo = (level) => "q_1=" + getQ1(level).toString(0);
        q1 = theory.createUpgrade(1, currency, new FirstFreeCost(new ExponentialCost(20, 1.4)));
        q1.getDescription = (amount) => Utils.getMath(getDesc(q1.level));
        q1.getInfo = (amount) => Utils.getMathTo(getInfo(q1.level), getInfo(q1.level + amount));
    }

    //q2
    {
        let getDesc = (level) => "q_2=2^{" + level+"}";
        let getInfo = (level) => "q_2=" + getQ2(level).toString(0);
        q2 = theory.createUpgrade(2, currency, new ExponentialCost(1, Math.log2(10)));
        q2.getDescription = (amount) => Utils.getMath(getDesc(q2.level));
        q2.getInfo = (amount) => Utils.getMathTo(getInfo(q2.level), getInfo(q2.level + amount));
    }

    //K
    {
        let getDesc = (level) => "K= " + getK(level).toString(0);
        let getInfo = (level) => "K=" + getK(level).toString(0);
        k = theory.createUpgrade(3, currency, new ExponentialCost(1, Math.log2(10)));
        k.getDescription = (amount) => Utils.getMath(getDesc(k.level));
        k.getInfo = (amount) => Utils.getMathTo(getInfo(k.level), getInfo(k.level + amount));
        k.bought = (_) => update_divisor = true;
        k.level = 1;
    }
        

    /////////////////////
    // Permanent Upgrades
    theory.createPublicationUpgrade(0, currency, 1e8);
    theory.createBuyAllUpgrade(1, currency, 1e15);
    theory.createAutoBuyerUpgrade(2, currency, 1e25);

    /////////////////////
    // Checkpoint Upgrades
    theory.setMilestoneCost(new LinearCost(10,5));

    {
        q1Exp = theory.createMilestoneUpgrade(0, 4);
        q1Exp.description = Localization.getUpgradeIncCustomExpDesc("q_1", "0.015");
        q1Exp.info = Localization.getUpgradeIncCustomExpInfo("q_1", "0.015");
        q1Exp.boughtOrRefunded = (_) => theory.invalidatePrimaryEquation();
    }

    updateAvailability();
}

var updateAvailability = () => {
   
}

var tick = (elapsedTime, multiplier) => {
    let dt = BigNumber.from(elapsedTime*multiplier); 
    let bonus = theory.publicationMultiplier; 
    let vq1 = getQ1(q1.level).pow(getQ1Exp(q1Exp.level));
    let vq2 = getQ2(q2.level);
    let vt = getT(t.level);

    if(update_divisor){
        lambda_helper = BigNumber.TWO.pow(getK(k.level));

        let temp = -getK(k.level)*BigNumber.TWO.log10();
        let exp = Math.floor(temp),
        man = BigNumber.TEN.pow(temp-exp);
        lambda_man = man;
        lambda_exp = exp;

        update_divisor = false;
    }

    t_cumulative += vt * dt;

    rho_dot = t_cumulative * vq1 * vq2 * approx(getK(k.level)) * dt;

    currency.value += bonus * rho_dot;

    theory.invalidateTertiaryEquation();
}

var getInternalState = () => `${t_cumulative} ${lambda_helper}`;

var setInternalState = (state) => {
    let values = state.split(" ");
    if (values.length > 0) t_cumulative = parseBigNumber(values[0]);
    if (values.length > 1) lambda_helper = parseBigNumber(values[1]);
}

var postPublish = () => {
    t_cumulative = BigNumber.ZERO;
    update_divisor = true;
}

var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 50;
    theory.primaryEquationScale = 1.35;
    let result = "\\begin{matrix}";
    result += "\\dot{\\rho}=\\frac{q_1";
    if (q1Exp.level > 0) result += `^{${1+q1Exp.level*0.015}}`;
    result += "q_2}{\\int_{0}^{t}f(x)dx - _{\\lambda}\\int_{0}^{t}f(x)dx^{\\lambda}}";
    result += "\\end{matrix}\\\\";
    return result;
}

var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 60;
    let result = "\\lambda = \\sum_{n=1}^{K}\\frac{1}{2^{n}}";
    result+= "\\\\\\\\" + theory.latexSymbol + "=\\max\\rho^{0.1}";
    return result;
}

var getTertiaryEquation = () => {
    let result = "";
    result += "\\begin{matrix}t =";
    result += t_cumulative.toString();
    
    // 1/2^k in xxxe-xxx form
    //man =  10^((log(1)-k*log(2)) - exp)
    //exp = floor(log(1) - k*log(2))


    result += ",&1/2^{k}=";
    if(lambda_helper <= 10000){
        result += (BigNumber.ONE/lambda_helper).toString(4);
    }else { 
        let exp = 1+Math.floor(lambda_helper.log10().toNumber()),
        mts = ((BigNumber.TEN.pow(exp)/lambda_helper).toString());
        result += `${mts}e\\text{-}${exp}`
    }

    result += ",&\\dot{\\rho} ="
    result += rho_dot.toString();
    result += "\\end{matrix}";

    return result;
}


var approx = (k_v) =>{
    return - (BigNumber.from(19.85298380047856)) - (BigNumber.PI.pow(BigNumber.TWO.pow(-k_v))-BigNumber.ONE);
}



var norm_int = () => {
    return (BigNumber.PI.pow(BigNumber.FIVE)+BigNumber.FIVE*(BigNumber.PI.pow(BigNumber.FOUR)+
    BigNumber.FOUR*(BigNumber.PI.pow(BigNumber.THREE)+BigNumber.THREE*BigNumber.PI.pow(BigNumber.TWO))))/(BigNumber.FIVE*BigNumber.TWO*BigNumber.FOUR*BigNumber.THREE) + BigNumber.PI;
}


var frac_int = (k_v) =>{    

    let Gterm = BigNumber.ONE/BigNumber.from(gamma(k_v));
    
    let term1 = BigNumber.TWO.pow(BigNumber.FIVE * k_v);

    let term2 = BigNumber.TWO.pow(BigNumber.FOUR * k_v) 
        * (BigNumber.FIVE * BigNumber.TWO.pow(k_v) - BigNumber.ONE);

    let term3 = BigNumber.TWO.pow(BigNumber.THREE * k_v) 
        * (BigNumber.FIVE * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
        * (BigNumber.FOUR * BigNumber.TWO.pow(k_v) - BigNumber.ONE);
    
    let term4 = BigNumber.TWO.pow(BigNumber.TWO * k_v) 
    * (BigNumber.FIVE * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.FOUR * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.THREE * BigNumber.TWO.pow(k_v) - BigNumber.ONE);
    
    let term5 = BigNumber.TWO.pow(k_v) 
    * (BigNumber.FIVE * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.FOUR * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.THREE * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.TWO * BigNumber.TWO.pow(k_v) - BigNumber.ONE);

    let denonminator = (BigNumber.TWO.pow(k_v) - BigNumber.ONE) 
    * (BigNumber.FIVE * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.FOUR * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.THREE * BigNumber.TWO.pow(k_v) - BigNumber.ONE)
    * (BigNumber.TWO * BigNumber.TWO.pow(k_v) - BigNumber.ONE)

    return Gterm * BigNumber.PI / BigNumber.PI.pow(BigNumber.TWO.pow(-k_v)) *
        (term1 * BigNumber.PI.pow(4) + term2 * BigNumber.PI.pow(3) + term3 * BigNumber.PI.pow(2) + term4 * BigNumber.PI + term5)
        /(denonminator);
}

//undefined at k_v = 0
var gamma = (k_v) => {
    if (k_v == 1) return 1.77245;
    if (k_v == 2) return 1.22542;
    if (k_v == 3) return 1.08965;
    if (k_v == 4) return 1.04018;
    if (k_v == 5) return 1.01903;
    if (k_v == 6) return 1.00926;
    if (k_v == 7) return 1.00457;
    if (k_v == 8) return 1.00227;
    if (k_v == 9) return 1.00113;
    if (k_v == 10) return 1.00056;
    return 1;
}

//for small num normal factorial
//for big num use of Stirlings approximation
var factorial = (num) => {
    if (num.isZero) return BigNumber.ONE;
    if(num < BigNumber.HUNDRED){
        let temp = BigNumber.ONE;
        for(let i = BigNumber.ONE; i<=num; i+=BigNumber.ONE){
            temp *= i;
        }
        return temp;
    }
    return (BigNumber.TWO * BigNumber.PI * num).sqrt() * (num/BigNumber.E).pow(num);
}

var getPublicationMultiplier = (tau) => tau.isZero ? BigNumber.ONE : tau;
var getPublicationMultiplierFormula = (symbol) => "{" + symbol + "}";
var getTau = () => currency.value.pow(BigNumber.from(0.1));
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(10), currency.symbol];
var get2DGraphValue = () => currency.value.sign * (BigNumber.ONE + currency.value.abs()).log10().toNumber();

var getT = (level) => BigNumber.from(0.2 + level * 0.2);
var getQ1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0);
var getK = (level) => Utils.getStepwisePowerSum(level, 2, 100, 0);
var getQ2 = (level) => BigNumber.TWO.pow(level);
var getQ1Exp = (level) => BigNumber.from(1 + level * 0.015);

init();