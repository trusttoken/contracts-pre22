//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LChainLink.sol";

library LEnumerableMetadata {
    using LChainLink for LChainLink.Link;

    // chain.
    // "map key" is keccak256("key")
    struct Metadata {
        string key;
        bytes32 typeID;
        bytes data;
        LChainLink.Link link;
    }

    struct MetadataSet {
        mapping(bytes32 => Metadata) kvData;
        uint256 size;
    }

    function _getKeyID(string memory key) internal pure returns (bytes32) {
        require(bytes(key).length != 0, "key is empty");

        bytes32 id = keccak256(abi.encodePacked(key));

        require(!LChainLink._isEmpty(id), "id error");
        return id;
    }

    function _init(MetadataSet storage m) internal {
        m.kvData[LChainLink.SENTINEL_ID].link._init();
    }

    function _checkKvDatas(bytes[] memory kvDatas) internal pure {
        for (uint256 i = 0; i < kvDatas.length; i++) {
            _parseKvData(kvDatas[i]);
        }
    }

    function _parseKvData(bytes memory data)
        internal
        pure
        returns (
            string memory,
            bytes32,
            bytes memory
        )
    {
        return abi.decode(data, (string, bytes32, bytes));
    }

    function _encodeKvData(
        string memory key,
        bytes32 typeID,
        bytes memory data,
        string memory desc
    ) internal pure returns (bytes memory) {
        return abi.encode(key, typeID, data, desc);
    }

    function _setBytesSlice(MetadataSet storage m, bytes[] memory mds)
        internal
    {
        for (uint256 i = 0; i < mds.length; i++) {
            (
                string memory key,
                bytes32 typeID,
                bytes memory data
            ) = _parseKvData(mds[i]);

            if (data.length == 0) {
                _del(m, key);
            } else {
                _addOrChange(m, key, typeID, data);
            }
        }
    }

    function _addOrChange(
        MetadataSet storage m,
        string memory key,
        bytes32 typeID,
        bytes memory data
    ) internal {
        bytes32 keyID = _getKeyID(key);

        Metadata storage md = m.kvData[keyID];

        if (!md.link._isEmpty()) {
            // change data
            if (md.typeID != typeID) {
                md.typeID = typeID;
            }

            md.data = data;

            return;
        }

        // add data
        md.key = key;
        md.typeID = typeID;
        md.data = data;

        Metadata storage sentinel = m.kvData[LChainLink.SENTINEL_ID];
        md.link._addItemLink(
            sentinel.link,
            m.kvData[sentinel.link.next].link,
            keyID
        );

        m.size++;
    }

    function _del(MetadataSet storage m, string memory key) internal {
        bytes32 keyID = _getKeyID(key);
        Metadata storage md = m.kvData[keyID];

        if (md.link._isEmpty()) {
            return;
        }

        md.link._delItemLink(
            m.kvData[md.link.pre].link,
            m.kvData[md.link.next].link
        );

        delete m.kvData[keyID];
        m.size--;
    }

    function _getByKey(MetadataSet storage m, string memory key)
        internal
        view
        returns (bytes32 typeID, bytes memory data)
    {
        return _get(m, _getKeyID(key));
    }

    function _get(MetadataSet storage m, bytes32 keyID)
        internal
        view
        returns (bytes32 typeID, bytes memory data)
    {
        Metadata storage md = m.kvData[keyID];

        return (md.typeID, md.data);
    }

    function _getAllKeys(
        MetadataSet storage m,
        string memory startKey,
        uint256 pageSize
    ) internal view returns (string[] memory keys) {
        keys = new string[](pageSize);
        uint256 idx = 0;

        bytes32 nowKeyID;
        if (bytes(startKey).length == 0) {
            nowKeyID = LChainLink.SENTINEL_ID;
        } else {
            nowKeyID = _getKeyID(startKey);
        }

        nowKeyID = m.kvData[nowKeyID].link._getNextID();
        while (idx < pageSize && !LChainLink._isEmpty(nowKeyID)) {
            Metadata storage md = m.kvData[nowKeyID];

            keys[idx] = md.key;

            nowKeyID = md.link._getNextID();
            idx++;
        }

        assembly {
            mstore(keys, idx)
        }

        return keys;
    }

    // return encode(string key, bytes32 typeID, bytes value)[]
    function _getAll(
        MetadataSet storage m,
        string memory startKey,
        uint256 pageSize
    ) internal view returns (bytes[] memory datas) {
        datas = new bytes[](pageSize);
        uint256 idx = 0;

        bytes32 nowKeyID;
        if (bytes(startKey).length == 0) {
            nowKeyID = LChainLink.SENTINEL_ID;
        } else {
            nowKeyID = _getKeyID(startKey);
        }

        nowKeyID = m.kvData[nowKeyID].link._getNextID();
        while (idx < pageSize && !LChainLink._isEmpty(nowKeyID)) {
            Metadata storage md = m.kvData[nowKeyID];

            datas[idx] = abi.encode(md.key, md.typeID, md.data);

            nowKeyID = md.link._getNextID();
            idx++;
        }

        assembly {
            mstore(datas, idx)
        }

        return datas;
    }
}
