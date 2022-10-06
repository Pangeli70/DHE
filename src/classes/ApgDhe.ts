/** -----------------------------------------------------------------------
 * @module [Dhe]
 * @author [APG] ANGELI Paolo Giusto
 * @version 0.0.1 [APG 2021/02/21]
 * @version 0.8.0 [APG 2022/03/27] Generalization as module
 * @version 0.9.2 [APG 2022/10/06] Github Beta
 * -----------------------------------------------------------------------
 */

import { Uts } from "../../deps.ts"
import { eApgDheChunkTypes } from "../enums/eApgDheChunkTypes.ts";
import { IApgDheCacheableItem } from "../interfaces/IApgDheCacheableItem.ts";
import { IApgDheChunk } from "../interfaces/IApgDheChunk.ts";
import { TApgDheDictionary } from "../types/TApgDheDictionary.ts";


export class ApgDhe {
  static readonly ITEM_CACHE_EXPIRATION = 100000; // ms

  static cacheEnabled = false;

  static fileChunksCache: { [key: string]: IApgDheCacheableItem } = {};


  private static _getTemplate(atemplateFile: string): string {
    return Uts.ApgUtsFs.ReadTextFileSync(atemplateFile);
  }


  private static _parseTemplate(atemplateContent: string): IApgDheChunk[] {

    const r: IApgDheChunk[] = [];

    const firstSplit: string[] = atemplateContent.split("}}");

    firstSplit.forEach(element => {
      const tempSplit: string[] = element.split("{{");

      const staticChunk: IApgDheChunk = {
        content: tempSplit[0],
        type: eApgDheChunkTypes.STATIC
      }
      r.push(staticChunk);

      if (tempSplit.length > 1) {

        const placeholderContent = tempSplit[1].trim();

        // found a command: a potential loop or if statement
        if (placeholderContent[0] === "#") {

          const command = placeholderContent.split(' ');

          switch (command[1]) {
            case "SUB": {
              if (command.length != 3) {
                throw new Error(`Sub command {{${placeholderContent}}} is not correct, check spaces`)
              }
              const ifChunk: IApgDheChunk = {
                content: command[2],
                type: eApgDheChunkTypes.SUB
              }
              r.push(ifChunk);
              break;
            }
            case "IF": {
              if (command.length != 3) {
                throw new Error(`IG command {{${placeholderContent}}} is not correct, maybe the variable name is missing`)
              }
              const ifChunk: IApgDheChunk = {
                content: command[2],
                type: eApgDheChunkTypes.IF
              }
              r.push(ifChunk);
              break;
            }
            case "IF_NOT": {
              if (command.length != 3) {
                throw new Error(`IF_NOT command {{${placeholderContent}}} is not correct, maybe variable name is missing`)
              }
              const elseChunk: IApgDheChunk = {
                content: command[2],
                type: eApgDheChunkTypes.IF_NOT
              }
              r.push(elseChunk);
              break;
            }
            case "END_IF": {
              const ifChunk: IApgDheChunk = {
                content: "",
                type: eApgDheChunkTypes.END_IF
              }
              r.push(ifChunk);
              break;
            }
            case "LOOP": {
              if (command.length != 3) {
                throw new Error(`LOOP command {{${placeholderContent}}} is not correct, maybe the name of the array ìs missing`)
              }
              const loopChunk: IApgDheChunk = {
                content: command[2],
                type: eApgDheChunkTypes.BEGIN_LOOP
              }
              r.push(loopChunk);
              break;
            }
            case "END_LOOP": {
              const endLoopChunk: IApgDheChunk = {
                content: "",
                type: eApgDheChunkTypes.END_LOOP
              }
              r.push(endLoopChunk);
              break;
            }
            default: {
              throw new Error(`Unrecognized DHE command {{${placeholderContent}}}`);
            }
          }
        }
        else {
          const valueChunk: IApgDheChunk = {
            content: tempSplit[1],
            type: eApgDheChunkTypes.VALUE
          }
          r.push(valueChunk);
        }
      }
    });

    return r;
  }


  private static _getChunks(afile: string): IApgDheChunk[] | undefined {

    let r: IApgDheChunk[] | undefined;
    const currentTime = performance.now();

    try {

      if (ApgDhe.fileChunksCache[afile] == undefined) {

        const templateContent = ApgDhe._getTemplate(afile);
        r = ApgDhe._parseTemplate(templateContent);

        if (this.cacheEnabled) {
          const cacheableItem: IApgDheCacheableItem = {
            numberOfRequests: 1,
            chunks: r,
            lastRequest: currentTime,
          }
          ApgDhe.fileChunksCache[afile] = cacheableItem;
        }

      } else {

        const cacheableItem: IApgDheCacheableItem = ApgDhe.fileChunksCache[afile];
        cacheableItem.numberOfRequests++;

        const deltaTime = currentTime - cacheableItem.lastRequest;

        if (deltaTime > ApgDhe.ITEM_CACHE_EXPIRATION) {
          const templateContent = this._getTemplate(afile);
          cacheableItem.chunks = this._parseTemplate(templateContent);
          cacheableItem.lastRequest = currentTime;
          ApgDhe.fileChunksCache[afile] = cacheableItem;
        }

        r = cacheableItem.chunks;

      }

    } catch (_error) {

      r = [{
        content: `<div><h1>Error reading dynamic resource template (${afile}): ${_error}</h1></div>`,
        type: eApgDheChunkTypes.STATIC
      }];

    }
    return r;
  }


  private static _processChunks(achunks: IApgDheChunk[], adata: TApgDheDictionary) {
    const fragments: string[] = [];

    for (let i = 0; i < achunks.length; i++) {

      const currentChunk = achunks[i];
      switch (currentChunk.type) {
        case eApgDheChunkTypes.STATIC:
          {
            fragments.push(currentChunk.content);
            break;
          }
        case eApgDheChunkTypes.VALUE:
          {
            const fragment = this._processValueChunk(currentChunk.content, adata);
            fragments.push(fragment);
            break;
          }
        case eApgDheChunkTypes.BEGIN_LOOP:
          {
            const r = this._processLoopChunk(i, currentChunk.content, adata, achunks);
            fragments.push(r.fragment);
            i = r.i;
            break;
          }
        case eApgDheChunkTypes.IF:
          {
            const r = this._processIfChunk(i, currentChunk.content, adata, achunks, true);
            fragments.push(r.fragment);
            i = r.i;
            break;
          }
        case eApgDheChunkTypes.IF_NOT:
          {
            const r = this._processIfChunk(i, currentChunk.content, adata, achunks, false);
            fragments.push(r.fragment);
            i = r.i;
            break;
          }

      }

    }

    return fragments.join("");
  }


  private static _getLoopChunks(
    i: number,
    dynamicResourceChunks: IApgDheChunk[],
    loopChunks: IApgDheChunk[]
  ) {
    let nestingLevel = 0;
    let endFound = false;
    do {

      i++;
      const currentSub = dynamicResourceChunks[i];

      if (currentSub.type == eApgDheChunkTypes.END_LOOP) {
        if (nestingLevel == 0) {
          endFound = true;
        }
        else {
          loopChunks.push(currentSub);
          nestingLevel--;
        }
      }
      else {
        loopChunks.push(currentSub);
        if (currentSub.type == eApgDheChunkTypes.BEGIN_LOOP) {
          nestingLevel++;
        }
      }
    } while (!endFound);
    return i;
  }


  private static _getIfChunks(
    i: number,
    dynamicResourceChunks: IApgDheChunk[],
    aifChunks: IApgDheChunk[]
  ) {
    let nestingLevel = 0;
    let endFound = false;
    do {

      i++;
      if (i >= dynamicResourceChunks.length) {
        throw new Error("Dynamic resource chunks does not contains a proper END_IF tag");
      }
      const currentSub = dynamicResourceChunks[i];

      if (currentSub.type == eApgDheChunkTypes.END_IF) {
        if (nestingLevel == 0) {
          endFound = true;
        }
        else {
          aifChunks.push(currentSub);
          nestingLevel--;
        }
      }
      else {
        aifChunks.push(currentSub);
        if (
          currentSub.type == eApgDheChunkTypes.IF ||
          currentSub.type == eApgDheChunkTypes.IF_NOT
        ) {
          nestingLevel++;
        }
      }
    } while (!endFound);
    return i;
  }


  private static _processLoopChunk(
    i: number,
    valueName: string,
    adata: TApgDheDictionary,
    dynamicResourceChunks: IApgDheChunk[]
  ) {

    let fragment: string;

    if (!adata[valueName]) {
      fragment = "{{" + valueName + " - NOT FOUND !!!}}";
    }
    else if (!Array.isArray(adata[valueName])) {
      fragment = "{{" + valueName + " - ISN'T AN ARRAY!!!";
    }
    else {

      // from here must parse through until we find the proper end loop chunk
      // we are checking for nested loops too
      const loopChunks: IApgDheChunk[] = [];
      i = this._getLoopChunks(i, dynamicResourceChunks, loopChunks);

      const array = <TApgDheDictionary[]>adata[valueName];
      const rows: string[] = [];

      for (let j = 0; j < array.length; j++) {
        rows.push(this._processChunks(loopChunks, array[j]));
      }
      fragment = rows.join("");

    }
    return { fragment, i };
  }


  private static _processIfChunk(
    i: number,
    valueName: string,
    adata: TApgDheDictionary,
    dynamicResourceChunks: IApgDheChunk[],
    aifMode: boolean
  ) {

    let fragment = "";

    // We must parse through the chunks until we find the proper End_if chunk
    // We are checking for nested ifs recursively
    const ifChunks: IApgDheChunk[] = [];
    const endIfIndex = this._getIfChunks(i, dynamicResourceChunks, ifChunks);

    const value = adata[valueName];

    // verify if is not boolean and give error message
    if (
      (typeof (value) == 'string') &&
      (value) != 'true' &&
      (value) != 'false' &&
      (value) != '0' &&
      (value) != '1'
    ) {
      fragment = "{{" + valueName + " - ISN'T A BOOLEAN VALUE!!! allowed values are 'true', 'false', '0', '1'}}";
    }
    else {

      let boolValue = false;

      // if value is undefined do nothing. Treat condition as falsy
      if (value) {
        if (typeof (value) == 'string') {

          boolValue = Uts.ApgUtsIs.IsTrueish(value as string);

        } else if (typeof (value) == 'boolean') {

          boolValue = value as boolean;
        }
      }

      if (aifMode === false) {
        boolValue = !boolValue;
      }

      if (boolValue) {
        fragment = this._processChunks(ifChunks, adata);
      }

    }
    i = endIfIndex;
    return { fragment, i };
  }


  private static _processValueChunk(valueName: string, adata: TApgDheDictionary): string {
    let r: string;

    if (!adata[valueName]) {
      r = "{{" + valueName + " - NOT FOUND !!!}}";
    }
    else if (Array.isArray(adata[valueName])) {
      r = "{{" + valueName + " - IS AN ARRAY!!!";
    }
    else {
      r = <string>adata[valueName];
    }
    return r;

  }


  public static GetPartial(apartialFile: string): string {

    return Uts.ApgUtsFs.ReadTextFileSync(apartialFile);

  }


  public static Process(aresource: string, adata: TApgDheDictionary): string {

    const chunks: IApgDheChunk[] | undefined = ApgDhe._getChunks(aresource);

    if (!chunks) {
      return "ERROR 021354688";
    }

    return ApgDhe._processChunks(chunks, adata);

  }


}
