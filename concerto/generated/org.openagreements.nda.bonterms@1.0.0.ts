/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: org.openagreements.nda.bonterms@1.0.0

// imports
import {IConcept} from './concerto@1.0.0';

// interfaces
export interface IParty extends IConcept {
   name: string;
}

export interface INDATerms extends IConcept {
   effective_date: Date;
   purpose: string;
   nda_term: string;
   confidentiality_period: string;
}

export interface IGoverningLaw extends IConcept {
   governing_law: string;
   courts: string;
}

export interface IBontermsMutualNDA extends IConcept {
   party_1: IParty;
   party_2: IParty;
   terms: INDATerms;
   legal: IGoverningLaw;
}

