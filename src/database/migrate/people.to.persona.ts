/* eslint-disable import/no-deprecated */
import {
    getMyIdentitiesDB,
    queryLocalKeyDB,
    queryPeopleDB,
    PersonRecord,
    PersonRecordPublic,
    PersonRecordPublicPrivate,
} from './_deprecated_people_db'
import * as persona from '../Persona/Persona.db'
import { ECKeyIdentifier, ProfileIdentifier } from '../type'
import { IdentifierMap } from '../IdentifierMap'
import { IDBPTransaction } from 'idb'
import { CryptoKeyToJsonWebKey } from '../../utils/type-transform/CryptoKey-JsonWebKey'

export default async function migratePeopleToPersona() {
    const myIDs = await getMyIdentitiesDB()
    const otherIDs = await queryPeopleDB(() => true)
    await migrateHelper_operateDB(myIDs, otherIDs, queryLocalKeyDB)
}
export async function migrateHelper_operateDB(
    myIDs: PersonRecordPublicPrivate[],
    otherIDs: PersonRecord[],
    getLocalKey: (identifier: ProfileIdentifier) => Promise<CryptoKey | null>,
) {
    const [personaMap, profilesMap, attachRelationMap] = await migrateHelper_importPersonaFromPersonRecord(
        myIDs,
        otherIDs,
        getLocalKey,
    )

    const t: IDBPTransaction<any, any> = (await persona.PersonaDBAccess()).transaction(
        ['personas', 'profiles'],
        'readwrite',
    )
    for (const [v, incomingRecord] of personaMap) {
        const currentRecord = await persona.queryPersonaDB(incomingRecord.identifier, t)
        if (!currentRecord) {
            await persona.createPersonaDB(incomingRecord, t)
        }
    }
    for (const [v, incomingRecord] of profilesMap) {
        const currentRecord = await persona.queryProfileDB(incomingRecord.identifier, t)
        if (!currentRecord) {
            // remove the linkedPersona, call attachProfileDB to keep consistency
            const { linkedPersona, ...rec } = incomingRecord
            await persona.createProfileDB(rec, t)
        }
    }
    for (const [profileID, personaID] of attachRelationMap) {
        const currentRecord = await persona.queryPersonaDB(personaID, t)
        const data: persona.LinkedProfileDetails = currentRecord!.linkedProfiles.get(profileID) ?? {
            connectionConfirmState: 'pending',
        }
        await persona.attachProfileDB(profileID, personaID, data, t)
    }
}
async function migrateHelper_importPersonaFromPersonRecord(
    myIDs: PersonRecordPublicPrivate[],
    otherIDs: PersonRecord[],
    getLocalKey: (identifier: ProfileIdentifier) => Promise<CryptoKey | null>,
) {
    const jwkMap = new Map<CryptoKey, JsonWebKey>()
    const attachRelationMap = new IdentifierMap<ProfileIdentifier, ECKeyIdentifier>(new Map())
    const localKeysMap = new IdentifierMap<ProfileIdentifier, CryptoKey>(new Map())
    const personaMap = new IdentifierMap<ECKeyIdentifier, persona.PersonaRecord>(new Map())
    const profilesMap = new IdentifierMap<ProfileIdentifier, persona.ProfileRecord>(new Map())

    await Promise.all(
        otherIDs.concat(myIDs).map(async value => {
            if (value.publicKey) jwkMap.set(value.publicKey, await CryptoKeyToJsonWebKey(value.publicKey))
            if (value.privateKey) jwkMap.set(value.privateKey, await CryptoKeyToJsonWebKey(value.privateKey))

            if (value.publicKey) {
                attachRelationMap.set(value.identifier, await ECKeyIdentifier.fromCryptoKey(value.publicKey))
            }
        }),
    )
    await Promise.all(
        myIDs.map(async value => {
            const key = await getLocalKey(value.identifier)
            key && localKeysMap.set(value.identifier, key)
        }),
    )
    for (const profile of otherIDs.concat(myIDs)) {
        const ec_id = attachRelationMap.get(profile.identifier)!
        if (profile.publicKey) {
            updateOrCreatePersonaRecord(personaMap, ec_id, profile as PersonRecordPublic, jwkMap)
        }
        updateOrCreateProfileRecord(profilesMap, attachRelationMap, localKeysMap, profile)
    }

    return [personaMap, profilesMap, attachRelationMap] as const
}

function updateOrCreatePersonaRecord(
    map: IdentifierMap<ECKeyIdentifier, persona.PersonaRecord>,
    ec_id: ECKeyIdentifier,
    profile: PersonRecordPublic,
    cryptoKeyMap: Map<CryptoKey, JsonWebKey>,
) {
    const rec = map.get(ec_id)
    if (rec) {
        if (profile.privateKey) {
            rec.privateKey = cryptoKeyMap.get(profile.privateKey)!
        }
        rec.linkedProfiles.set(profile.identifier, {
            connectionConfirmState: 'pending',
        })
    } else {
        map.set(ec_id, {
            privateKey: cryptoKeyMap.get(profile.privateKey!)!,
            publicKey: cryptoKeyMap.get(profile.publicKey)!,
            createdAt: new Date(0),
            updatedAt: new Date(),
            linkedProfiles: new IdentifierMap(new Map()),
            identifier: ec_id,
        })
        map.get(ec_id)!.linkedProfiles.set(profile.identifier, {
            connectionConfirmState: 'pending',
        })
    }
}
function updateOrCreateProfileRecord(
    map: IdentifierMap<ProfileIdentifier, persona.ProfileRecord>,
    ec_idMap: IdentifierMap<ProfileIdentifier, ECKeyIdentifier>,
    localKeyMap: IdentifierMap<ProfileIdentifier, CryptoKey>,
    profile: PersonRecord,
) {
    const rec = map.get(profile.identifier)
    if (rec) {
        rec.nickname = rec.nickname ?? profile.nickname
    } else {
        map.set(profile.identifier, {
            createdAt: new Date(0),
            updatedAt: new Date(),
            identifier: profile.identifier,
            nickname: profile.nickname,
            localKey: localKeyMap.get(profile.identifier),
            linkedPersona: ec_idMap.get(profile.identifier),
        })
    }
}
