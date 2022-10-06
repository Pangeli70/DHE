/** -----------------------------------------------------------------------
 * @module [Dhe]
 * @author [APG] ANGELI Paolo Giusto
 * @version 0.0.1 [APG 2021/02/21]
 * @version 0.8.0 [APG 2022/03/27] Generalization as module
 * @version 0.9.2 [APG 2022/10/06] Github Beta
 * -----------------------------------------------------------------------
*/
export type TObjectStringDictionary = {
    [key: string]:
    boolean |
    number |
    string |
    TObjectStringDictionary |
    TObjectStringDictionary[]
};

export type TApgDheDictionary = {
    [key: string]:
    boolean |
    number |   
    string |
    TObjectStringDictionary |
    TObjectStringDictionary[]
};