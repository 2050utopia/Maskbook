import { serializable } from '../utils/type-transform/Serialization'
import { RecipientDetail } from './post'
import { compressSecp256k1Key } from '../utils/type-transform/SECP256k1-Compression'
import { CryptoKeyToJsonWebKey } from '../utils/type-transform/CryptoKey-JsonWebKey'

/**
 * @internal symbol that used to construct this type from the Identifier
 */
const $fromString = Symbol()
/**
 * This type only refers to the stringified Identifier
 * person:...
 * group:...
 * post:...
 * post_iv:...
 * ec_key:...
 */
type Identifiers = 'person' | 'group' | 'post' | 'post_iv' | 'ec_key'
const fromStringCache = new Map<string, Identifier>()
export abstract class Identifier {
    static equals(a: Identifier, b: Identifier) {
        return a.equals(b)
    }
    public equals(other: Identifier) {
        return this === other || this.toText() === other.toText()
    }
    abstract toText(): string
    static fromString<T extends Identifier>(id: T): T
    static fromString(id: string): Identifier | null
    static fromString<T extends Identifier>(id: string | T): Identifier | null {
        if (id instanceof Identifier) return id
        if (fromStringCache.has(id)) return fromStringCache.get(id)!
        const [type, ...rest] = id.split(':') as [Identifiers, string]
        let result: Identifier | null = null
        if (type === 'person') result = ProfileIdentifier[$fromString](rest.join(':'))
        else if (type === 'group') result = GroupIdentifier[$fromString](rest.join(':'))
        else if (type === 'post') result = PostIdentifier[$fromString](rest.join(':'))
        else if (type === 'post_iv') result = PostIVIdentifier[$fromString](rest.join(':'))
        else if (type === 'ec_key') result = ECKeyIdentifier[$fromString](rest.join(':'))
        else return null
        if (result === null) return null
        fromStringCache.set(id, result)
        return result
    }

    static IdentifiersToString(a: Identifier[], isOrderImportant = false) {
        const ax = a.map(x => x.toText())
        if (!isOrderImportant) {
            ax.sort()
        }
        return ax.join(',')
    }
}

@serializable('ProfileIdentifier')
export class ProfileIdentifier extends Identifier {
    static readonly unknown = new ProfileIdentifier('localhost', '$unknown')
    get isUnknown() {
        return this.equals(ProfileIdentifier.unknown)
    }
    /**
     * @param network - Network belongs to
     * @param userId - User ID
     */
    constructor(public readonly network: string, public readonly userId: string) {
        super()
        noSlash(network)
        noSlash(userId)
    }
    toText() {
        return `person:${this.network}/${this.userId}`
    }
    friendlyToText() {
        return `${this.userId}@${this.network}`
    }
    static [$fromString](str: string) {
        const [network, userId] = str.split('/')
        if (!network || !userId) return null
        return new ProfileIdentifier(network, userId)
    }
}
export enum PreDefinedVirtualGroupNames {
    friends = '_default_friends_group_',
    followers = '_followers_group_',
    following = '_following_group_',
}

@serializable('GroupIdentifier')
export class GroupIdentifier extends Identifier {
    static getFriendsGroupIdentifier(who: ProfileIdentifier, groupId: string) {
        return new GroupIdentifier(who.network, who.userId, groupId)
    }
    static getDefaultFriendsGroupIdentifier(who: ProfileIdentifier) {
        return new GroupIdentifier(who.network, who.userId, PreDefinedVirtualGroupNames.friends)
    }
    constructor(
        public readonly network: string,
        public readonly virtualGroupOwner: string | null,
        public readonly groupID: string,
    ) {
        super()
        noSlash(network)
        noSlash(groupID)
        if (virtualGroupOwner === '') this.virtualGroupOwner = null
    }
    get ownerIdentifier() {
        if (this.virtualGroupOwner === null) throw new Error('Can not know the owner of this group')
        return new ProfileIdentifier(this.network, this.virtualGroupOwner)
    }
    toText() {
        return 'group:' + [this.network, this.virtualGroupOwner, this.groupID].join('/')
    }
    get isReal() {
        return !this.virtualGroupOwner
    }
    get isVirtual() {
        return !!this.virtualGroupOwner
    }
    static [$fromString](str: string) {
        const [network, belongs, groupID] = str.split('/')
        if (!network || !groupID) return null
        return new GroupIdentifier(network, belongs, groupID)
    }
}

@serializable('PostIdentifier')
export class PostIdentifier<T extends Identifier = Identifier> extends Identifier {
    /**
     * If identifier is a PostIdentifier, that means this post is binded with other post in some kind
     * e.g. a comment.
     */
    constructor(public readonly identifier: T, public readonly postId: string) {
        super()
        noSlash(postId)
    }
    toText() {
        return `post:${this.postId}/${this.identifier.toText()}`
    }
    static [$fromString](str: string) {
        const [postId, ...identifier] = str.split('/')
        const id = Identifier.fromString(identifier.join('/'))
        if (!id || !postId) return null
        return new PostIdentifier(id, postId)
    }
}

@serializable('PostIVIdentifier')
export class PostIVIdentifier extends Identifier {
    constructor(public readonly network: string, public readonly postIV: string) {
        super()
        if (postIV) this.postIV = postIV.replace(/\//g, '|')
    }
    toText() {
        return `post_iv:${this.network}/${this.postIV}`
    }
    static [$fromString](str: string) {
        const [network, iv] = str.split('/')
        if (!network || !iv) return null
        return new PostIVIdentifier(network, iv)
    }
}

/**
 * This class identify the point on an EC curve.
 * ec_key:secp256k1/CompressedPoint
 */
@serializable('ECKeyIdentifier')
export class ECKeyIdentifier extends Identifier {
    static async fromCryptoKey(key: CryptoKey) {
        return this.fromJsonWebKey(await CryptoKeyToJsonWebKey(key))
    }
    static fromJsonWebKey(key: JsonWebKey) {
        const x = compressSecp256k1Key(key, 'public')
        return new ECKeyIdentifier('secp256k1', x)
    }
    public readonly type = 'ec_key'
    constructor(public readonly curve: 'secp256k1', private encodedCompressedKey: string) {
        super()
        if (encodedCompressedKey !== undefined) this.encodedCompressedKey = encodedCompressedKey.replace(/\//g, '|')
    }
    // restore the / from |
    get compressedPoint() {
        return this.encodedCompressedKey.replace(/\|/g, '/')
    }
    toText() {
        return `ec_key:${this.curve}/${this.encodedCompressedKey}`
    }
    static [$fromString](str: string) {
        const [curve, point] = str.split('/')
        if (curve !== 'secp256k1') return null
        return new ECKeyIdentifier(curve, point)
    }
}

export type PersonaIdentifier = ECKeyIdentifier

/**
 * Because "/" is used to split parts in identifier
 * we should reject the "/"
 *
 * If you want to use it, you must first convert to something other
 */
function noSlash(str?: string) {
    if (!str) return
    if (str.split('/')[1]) throw new TypeError('Cannot contain / in a part of identifier')
}

export function constructPostRecipients(data: [ProfileIdentifier, RecipientDetail][]) {
    const x: Record<string, RecipientDetail> = {}
    for (const [id, detail] of data) {
        x[id.toText()] = detail
    }
    return x
}
