import React, { useState, createContext, useEffect, useContext } from "react";
import { Web3Context } from "../ContextProvider/ContextProvider";
import { RegulatorContext } from "../Regulator/RegulatorContextProvider";

//Ethereum contract JSON (abi, deployed networks, ...)
import RegulatorJSON from '../../contracts/Regulator.json';
import OperatorJSON from '../../contracts/TollBoothOperator.json';


export const OperatorContext = createContext();


export const OperatorContextProvider = (props) => {

    const {web3}                                = useContext(Web3Context);
    const {regulator}                           = useContext(RegulatorContext);
    const [operator, setOperator]               = useState(undefined);
    const [operatorAddress, setOperatorAddress] = useState("");
    const [logsCreatedOperators, setLogsCreatedOperators]   = useState([]);
    const [logsLoaded, setLogsLoaded]           = useState(false);
    const [toggleReloading, setToggleReloading] = useState(false);


    /**
     * Instance
     */
    useEffect(() => {
        (async () => {
            if(web3 && regulator){
                if(regulator._address && !logsLoaded){
                    try{
                        const networkID = await web3.eth.net.getId();
                        const contractNetwork = RegulatorJSON.networks[networkID];
                        const contractReceipt = await web3.eth.getTransactionReceipt(contractNetwork.transactionHash);

                        const pastEventsArray = await regulator.getPastEvents(
                            'LogTollBoothOperatorCreated',
                            {
                                //filter: { owner: account },
                                fromBlock: contractReceipt.blockNumber,
                                toBlock: "latest"
                            }
                        );

                        if(pastEventsArray.length > 0){

                            setLogsCreatedOperators(pastEventsArray);

                            const _instance = new web3.eth.Contract(
                                OperatorJSON.abi,
                                null
                            );
                            setOperator(_instance);

                            setLogsLoaded(true);
                        }
                        else{
                            console.log("no tollBoothOperator address available");
                        }
                    }
                    catch(error){
                        console.error(error);
                    }
                }
            }
        })();
    }, [web3, regulator]);

    //Error:
    //  Event listener was not possible with current provider: HTTPprovider
    // useEffect(() => {
    //     if(logsLoaded){
    //         regulator.events.LogTollBoothOperatorCreated({})
    //         .on('data', newEvent => {
    //             setLogsCreatedOperators(_eventLogs => ([
    //                 ..._eventLogs,
    //                 newEvent
    //             ]));
    //         });
    //     }

    //     return function cleanup(){
    //         regulator.events.LogTollBoothOperatorCreated().off('data');
    //     }
    // }, [logsLoaded]);

    useEffect(() => {
        if(logsLoaded && operatorAddress){
            (async () => {
                try{
                    console.log("operatorAddress was set to: ", operatorAddress);

                    const networkID = await web3.eth.net.getId();
                    const contractNetwork = RegulatorJSON.networks[networkID];

                    const _instance = new web3.eth.Contract(
                        OperatorJSON.abi,
                        contractNetwork && operatorAddress,
                    );
                    setOperator(_instance);
                }
                catch(error){}
            })();
        }
    }, [logsLoaded, operatorAddress]);


    /**
     * Provider
     */
    return(
        <OperatorContext.Provider value={
            {   operator,
                logsCreatedOperators, setLogsCreatedOperators,
                operatorAddress, setOperatorAddress,
                toggleReloading, setToggleReloading
            }}>
            {props.children}
        </OperatorContext.Provider>
    );
}