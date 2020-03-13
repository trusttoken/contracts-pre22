/*
    Copyright 2018 dYdX Trading Inc.
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import { Fraction } from "./Fraction.sol";
import { FractionMath } from "./FractionMath.sol";


/**
 * @title Exponent
 * @author dYdX
 *
 * This library contains an implementation for calculating e^X for arbitrary fraction X
 */
library Exponent {
    using SafeMath for uint256;
    using FractionMath for Fraction.Fraction128;

    // ============ Constants ============

    // 2**128 - 1
    uint128 constant public MAX_NUMERATOR = 340282366920938463463374607431768211455;

    // Number of precomputed integers, X, for E^((1/2)^X)
    uint256 constant public MAX_PRECOMPUTE_PRECISION = 32;

    // Number of precomputed integers, X, for E^X
    uint256 constant public NUM_PRECOMPUTED_INTEGERS = 32;

    // ============ Public Implementation Functions ============

    /**
     * Returns e^X for any fraction X
     *
     * @param  X                    The exponent
     * @param  precomputePrecision  Accuracy of precomputed terms
     * @param  maclaurinPrecision   Accuracy of Maclaurin terms
     * @return                      e^X
     */
    function exp(
        Fraction.Fraction128 memory X,
        uint256 precomputePrecision,
        uint256 maclaurinPrecision
    )
        internal
        pure
        returns (Fraction.Fraction128 memory)
    {
        require(
            precomputePrecision <= MAX_PRECOMPUTE_PRECISION,
            "Exponent#exp: Precompute precision over maximum"
        );

        Fraction.Fraction128 memory Xcopy = X.copy();
        if (Xcopy.num == 0) { // e^0 = 1
            return ONE();
        }

        // get the integer value of the fraction (example: 9/4 is 2.25 so has integerValue of 2)
        uint256 integerX = uint256(Xcopy.num).div(Xcopy.den);

        // if X is less than 1, then just calculate X
        if (integerX == 0) {
            return expHybrid(Xcopy, precomputePrecision, maclaurinPrecision);
        }

        // get e^integerX
        Fraction.Fraction128 memory expOfInt =
            getPrecomputedEToThe(integerX % NUM_PRECOMPUTED_INTEGERS);
        while (integerX >= NUM_PRECOMPUTED_INTEGERS) {
            expOfInt = expOfInt.mul(getPrecomputedEToThe(NUM_PRECOMPUTED_INTEGERS));
            integerX -= NUM_PRECOMPUTED_INTEGERS;
        }

        // multiply e^integerX by e^decimalX
        Fraction.Fraction128 memory decimalX = Fraction.Fraction128({
            num: Xcopy.num % Xcopy.den,
            den: Xcopy.den
        });
        return expHybrid(decimalX, precomputePrecision, maclaurinPrecision).mul(expOfInt);
    }

    /**
     * Returns e^X for any X < 1. Multiplies precomputed values to get close to the real value, then
     * Maclaurin Series approximation to reduce error.
     *
     * @param  X                    Exponent
     * @param  precomputePrecision  Accuracy of precomputed terms
     * @param  maclaurinPrecision   Accuracy of Maclaurin terms
     * @return                      e^X
     */
    function expHybrid(
        Fraction.Fraction128 memory X,
        uint256 precomputePrecision,
        uint256 maclaurinPrecision
    )
        internal
        pure
        returns (Fraction.Fraction128 memory)
    {
        assert(precomputePrecision <= MAX_PRECOMPUTE_PRECISION);
        assert(X.num < X.den);
        // will also throw if precomputePrecision is larger than the array length in getDenominator

        Fraction.Fraction128 memory Xtemp = X.copy();
        if (Xtemp.num == 0) { // e^0 = 1
            return ONE();
        }

        Fraction.Fraction128 memory result = ONE();

        uint256 d = 1; // 2^i
        for (uint256 i = 1; i <= precomputePrecision; i++) {
            d *= 2;

            // if Fraction > 1/d, subtract 1/d and multiply result by precomputed e^(1/d)
            if (d.mul(Xtemp.num) >= Xtemp.den) {
                Xtemp = Xtemp.sub1Over(uint128(d));
                result = result.mul(getPrecomputedEToTheHalfToThe(i));
            }
        }
        return result.mul(expMaclaurin(Xtemp, maclaurinPrecision));
    }

    /**
     * Returns e^X for any X, using Maclaurin Series approximation
     *
     * e^X = SUM(X^n / n!) for n >= 0
     * e^X = 1 + X/1! + X^2/2! + X^3/3! ...
     *
     * @param  X           Exponent
     * @param  precision   Accuracy of Maclaurin terms
     * @return             e^X
     */
    function expMaclaurin(
        Fraction.Fraction128 memory X,
        uint256 precision
    )
        internal
        pure
        returns (Fraction.Fraction128 memory)
    {
        Fraction.Fraction128 memory Xcopy = X.copy();
        if (Xcopy.num == 0) { // e^0 = 1
            return ONE();
        }

        Fraction.Fraction128 memory result = ONE();
        Fraction.Fraction128 memory Xtemp = ONE();
        for (uint256 i = 1; i <= precision; i++) {
            Xtemp = Xtemp.mul(Xcopy.div(uint128(i)));
            result = result.add(Xtemp);
        }
        return result;
    }

    /**
     * Returns a fraction roughly equaling E^((1/2)^x) for integer x
     */
    function getPrecomputedEToTheHalfToThe(
        uint256 x
    )
        internal
        pure
        returns (Fraction.Fraction128 memory)
    {
        assert(x <= MAX_PRECOMPUTE_PRECISION);

        uint128 denominator = [
            125182886983370532117250726298150828301,
            206391688497133195273760705512282642279,
            265012173823417992016237332255925138361,
            300298134811882980317033350418940119802,
            319665700530617779809390163992561606014,
            329812979126047300897653247035862915816,
            335006777809430963166468914297166288162,
            337634268532609249517744113622081347950,
            338955731696479810470146282672867036734,
            339618401537809365075354109784799900812,
            339950222128463181389559457827561204959,
            340116253979683015278260491021941090650,
            340199300311581465057079429423749235412,
            340240831081268226777032180141478221816,
            340261598367316729254995498374473399540,
            340271982485676106947851156443492415142,
            340277174663693808406010255284800906112,
            340279770782412691177936847400746725466,
            340281068849199706686796915841848278311,
            340281717884450116236033378667952410919,
            340282042402539547492367191008339680733,
            340282204661700319870089970029119685699,
            340282285791309720262481214385569134454,
            340282326356121674011576912006427792656,
            340282346638529464274601981200276914173,
            340282356779733812753265346086924801364,
            340282361850336100329388676752133324799,
            340282364385637272451648746721404212564,
            340282365653287865596328444437856608255,
            340282366287113163939555716675618384724,
            340282366604025813553891209601455838559,
            340282366762482138471739420386372790954,
            340282366841710300958333641874363209044
        ][x];
        return Fraction.Fraction128({
            num: MAX_NUMERATOR,
            den: denominator
        });
    }

    /**
     * Returns a fraction roughly equaling E^(x) for integer x
     */
    function getPrecomputedEToThe(
        uint256 x
    )
        internal
        pure
        returns (Fraction.Fraction128 memory)
    {
        assert(x <= NUM_PRECOMPUTED_INTEGERS);

        uint128 denominator = [
            340282366920938463463374607431768211455,
            125182886983370532117250726298150828301,
            46052210507670172419625860892627118820,
            16941661466271327126146327822211253888,
            6232488952727653950957829210887653621,
            2292804553036637136093891217529878878,
            843475657686456657683449904934172134,
            310297353591408453462393329342695980,
            114152017036184782947077973323212575,
            41994180235864621538772677139808695,
            15448795557622704876497742989562086,
            5683294276510101335127414470015662,
            2090767122455392675095471286328463,
            769150240628514374138961856925097,
            282954560699298259527814398449860,
            104093165666968799599694528310221,
            38293735615330848145349245349513,
            14087478058534870382224480725096,
            5182493555688763339001418388912,
            1906532833141383353974257736699,
            701374233231058797338605168652,
            258021160973090761055471434334,
            94920680509187392077350434438,
            34919366901332874995585576427,
            12846117181722897538509298435,
            4725822410035083116489797150,
            1738532907279185132707372378,
            639570514388029575350057932,
            235284843422800231081973821,
            86556456714490055457751527,
            31842340925906738090071268,
            11714142585413118080082437,
            4309392228124372433711936
        ][x];
        return Fraction.Fraction128({
            num: MAX_NUMERATOR,
            den: denominator
        });
    }

    // ============ Private Helper-Functions ============

    function ONE()
        private
        pure
        returns (Fraction.Fraction128 memory)
    {
        return Fraction.Fraction128({ num: 1, den: 1 });
    }
}