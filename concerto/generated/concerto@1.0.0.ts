/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: concerto@1.0.0

// imports

// Warning: Beware of circular dependencies when modifying these imports
import type {
	IParty,
	INDATerms,
	IGoverningLaw,
	IBontermsMutualNDA
} from './org.openagreements.nda.bonterms@1.0.0';

// interfaces
export interface IConcept {
   $class: string;
}

export type ConceptUnion = IParty | 
INDATerms | 
IGoverningLaw | 
IBontermsMutualNDA;

export interface IAsset extends IConcept {
   $identifier: string;
}

export interface IParticipant extends IConcept {
   $identifier: string;
}

export interface ITransaction extends IConcept {
   $timestamp: Date;
}

export interface IEvent extends IConcept {
   $timestamp: Date;
}

