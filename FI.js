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
// lambda = 1 - `lambda_man`e`lambda_exp` 
// 1/2^k in xxxe-xxx form
//man =  10^((log(1)-k*log(2)) - exp)
//exp = floor(log(1) - k*log(2))
var lambda_man = BigNumber.ZERO;
var lambda_exp = BigNumber.ZERO;
//used for approx calculation
var lambda_base = BigNumber.TWO;

var q = BigNumber.ZERO;
var r = BigNumber.ZERO;

var update_divisor = true;

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
        q1 = theory.createUpgrade(1, currency, new FirstFreeCost(new ExponentialCost(20, 5)));
        q1.getDescription = (amount) => Utils.getMath(getDesc(q1.level));
        q1.getInfo = (amount) => Utils.getMathTo(getInfo(q1.level), getInfo(q1.level + amount));
    }

    //q2
    {
        let getDesc = (level) => "q_2=2^{" + level+"}";
        let getInfo = (level) => "q_2=" + getQ2(level).toString(0);
        q2 = theory.createUpgrade(2, currency, new ExponentialCost(100, Math.log2(1e5)));
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
    let vk = getK(k.level);
    var vden = approx(vk,lambda_base);

    if(update_divisor){
        var temp = -vk*lambda_base.log10();

        lambda_exp = Math.floor(temp);
        lambda_man = BigNumber.TEN.pow(temp-lambda_exp);

        update_divisor = false;
    }

    t_cumulative += vt * dt;
    q += vq1 * vq2 * dt;
    r += vden * dt;
    
    rho_dot = t_cumulative * norm_int(q) * r * dt;

    currency.value += bonus * rho_dot;

    theory.invalidateTertiaryEquation();
}

var getInternalState = () => `${t_cumulative} ${lambda_man} ${lambda_exp} ${q} ${r}`;

var setInternalState = (state) => {
    let values = state.split(" ");
    if (values.length > 0) t_cumulative = parseBigNumber(values[0]);
    if (values.length > 1) lambda_man = parseBigNumber(values[1]);
    if (values.length > 2) lambda_exp = parseBigNumber(values[2]);
    if (values.length > 3) q = parseBigNumber(values[3]);
    if (values.length > 4) r = parseBigNumber(values[4]);
}

var postPublish = () => {
    t_cumulative = BigNumber.ZERO;
    q = BigNumber.ZERO;
    r = BigNumber.ZERO;
    update_divisor = true;
    k.level = 1;
}

var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 76;
    theory.primaryEquationScale = 1.3;
    let result = "\\begin{matrix}";
    result += "\\dot{\\rho}=tr\\int_{0}^{q}f(x)dx\\\\\\\\";
    result += "\\dot{r}=(\\int_{0}^{\\pi}f(x)dx - _{\\lambda}\\int_{0}^{\\pi}f(x)dx^{\\lambda})^{-1}";
    result += "\\end{matrix}";
    return result;
}

var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 100;
    theory.secondaryEquationScale = 1.2;
    let result = "";
    result += "&f(x) = 1 + x + \\frac{x^2}{2}+\\frac{x^3}{6}+\\frac{x^4}{24},";
    result += "\\quad\\lambda = \\sum_{n=1}^{K}\\frac{1}{2^{n}}\\\\\\\\";
    result += "&\\quad\\qquad\\qquad\\dot{q}=q_1"
    if (q1Exp.level > 0) result += `^{${1+q1Exp.level*0.015}}`;
    result += "q_2\\quad"+theory.latexSymbol + "=\\max\\rho^{0.1}";
    result += ""
    return result;
}

var getTertiaryEquation = () => {
    let result = "";
    result += "\\begin{matrix}";
    result += "&\\qquad\\qquad\\quad1/"+lambda_base.toNumber()+"^{k}=";
    if(getK(k.level)<8){
        result += (1/lambda_base.pow(getK(k.level))).toString(4);
    }else{
        result += lambda_man+"e"+lambda_exp;
    }
    
    result += ",&\\qquad\\qquad\\quad\\dot{\\rho} ="
    result += rho_dot.toString()+"\\\\";


    result += ",&\\quad t=";
    result += t_cumulative.toString();

    result += ",&q=";
    result += q.toString();

    result += ",&r=";
    result += r.toString()
    result += "\\end{matrix}";

    return result;
}

//Approximates value for 1/(normal integral - fractional integral) https://www.desmos.com/calculator/qugkxpt8nb
var approx = (k_v,base) =>{
    return BigNumber.TEN.pow(-norm_int(BigNumber.PI).log10()-BigNumber.ONE/(BigNumber.E+BigNumber.from(1.5))+k_v*base.log10());
}

//integrates f(x) and returns value with 0 -> limit, as limits
//TODO NEW EQ
var norm_int = (limit) => {
    return (limit.pow(5)/120+limit.pow(4)/24+limit.pow(3)/6+limit.pow(2)/2+limit);
}

/*
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


    return Gterm * BigNumber.PI * BigNumber.PI.pow(-BigNumber.TWO.pow(-k_v)) *
        (term1 * BigNumber.PI.pow(4) + term2 * BigNumber.PI.pow(3) + term3 * BigNumber.PI.pow(2) + term4 * BigNumber.PI + term5)
        /(denonminator);
}

//undefined at k_v = 0
var gamma = (k_v) => {
    if (k_v == 1) return 1.772453850905516027298;
    if (k_v == 2) return 1.225416702465177645129;
    if (k_v == 3) return 1.089652357422896951252;
    if (k_v == 4) return 1.04017701118676717146;
    if (k_v == 5) return 1.019032525056673950565;
    if (k_v == 6) return 1.009263984715686303151;
    if (k_v == 7) return 1.004570300975031369542;
    if (k_v == 8) return 1.002269894807266338071;
    if (k_v == 9) return 1.001131154070271719475;
    if (k_v == 10) return 1.00056463125610513418;
    if (k_v == 11) return 1.000282079501403060312;
    if (k_v == 12) return 1.000140980758729162528;
    if (k_v == 13) return 1.000070475636328154359;

    //gamma = 1+2^(-k)

    return 1;
}*/

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
var getK = (level) => BigNumber.from(level);
var getQ2 = (level) => BigNumber.TWO.pow(level);
var getQ1Exp = (level) => BigNumber.from(1 + level * 0.015);

init();