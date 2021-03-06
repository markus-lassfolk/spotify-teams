import { ConnectedComponent, IContext, IInjectedTeamsProps, Panel, PanelBody, PanelFooter, PanelHeader, Table, TBody, Th, THead, Tr } from 'msteams-ui-components-react';
import * as React from 'react';
import { style } from 'typestyle';
import { listenForCallback } from '../callback';
import { Api, getApi } from '../spotify/api';
import connect from '../state/connect';
import { Device, IStoreState, Playlist, Track } from '../state/state'
import Devices from './components/devices';
import { PlaylistItem } from './components/playlist-item';
import { TrackItem } from './components/track-item';


export interface ISpotifyState extends IStoreState {
    selectedPlaylistId: string
    selectedTrackId: string
}

export function appLayout(context: IContext) {
    const { rem } = context;
    return {
        container: style({
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
        }),
        main: style({
            flex: '1 1 auto',
            height: '100%',
            marginLeft: rem(0.2),
            overflow: 'auto',
        }),
        playlist: style({
            display: 'flex',
            height: '100vh'
        }),
        sidebar: style({
            flex: `0 0 ${rem(25.0)}`,
            height: '100%',
            maxWidth: rem(25.0),
            overflow: 'auto',
        })
    };
}


export class Spotify extends React.Component<{ selectedDevice: Device }, ISpotifyState> {
    private api: Api

    constructor(props: any) {
        super(props);
        this.state = {} as any as ISpotifyState
    }

    public render() {
        return <ConnectedComponent render={this.renderSpotify} />
    }

    public componentDidMount() {
        listenForCallback().then(async (token) => {
            this.api = getApi(token.token, token.refreshToken);;
            const playlists = await this.api.playlists.get();
            this.setState({ playlists: playlists.items });
            const t = await Promise.all(playlists.items.map(async (p) => {
                return { p, t: await this.api.playlists.tracks.getAll(p) };
            }));
            const tracks = t.reduce((m, tr) => {
                m.set(tr.p.id, tr.t);
                return m;
            }, new Map<string, Track[]>())
            this.setState({ tracks });
        });
    }

    private renderSpotify = (props: IInjectedTeamsProps) => {
        const { context } = props;
        const { rem, font } = context;
        const { sizes, weights } = font;
        const classes = appLayout(context);

        const styles = {
            header: { ...sizes.title, ...weights.semibold },
            playlist: { maxwWidth: rem(5), textOverflow: 'ellipsis' },
            section: { ...sizes.title2, marginTop: rem(1.4), marginBottom: rem(1.4), display: 'flex' },
            tracks: { width: 'calc(100% - 6px)' }
        };
        if (!this.state.playlists) {
            return <Panel>
                <PanelHeader>
                    <div style={styles.header}>Spotify</div>
                </PanelHeader>
                <PanelBody>
                    <div> Add playlists to see them here </div>
                </PanelBody>
                <PanelFooter />
            </Panel>
        }

        const playlists = this.state.playlists.map((p, index) => {
            return <PlaylistItem key={p.id} p={p} index={index} context={context}
                selected={this.state.selectedPlaylistId === p.id} onClick={this.onPlaylistClick} />
        });

        const tracks = ((this.state.tracks && this.state.tracks.get(this.state.selectedPlaylistId)) || []).map((p, index) => {
            return <TrackItem key={p.track.id + index} p={p} index={index} context={context}
                selected={this.state.selectedTrackId === p.track.id} onClick={this.onTrackClick} />
        });

        return (
            <div className={classes.container}>
                <div>
                    <Devices />
                </div>
                <div className={classes.playlist}>
                    <div className={classes.sidebar}>
                        <div>
                            <Table style={styles.playlist}>
                                <THead>
                                    <Tr>
                                        <Th >Playlists</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {playlists}
                                </TBody>
                            </Table>
                        </div>
                    </div>
                    <div className={classes.main}>
                        <div>
                            {tracks.length ? <Table style={{ ...styles.tracks, marginLeft: '2px' }}>
                                <THead>
                                    <Tr>
                                        <Th>Title</Th>
                                        <Th>Artist</Th>
                                        <Th>Album</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {tracks}
                                </TBody>
                            </Table> : void 0}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private onPlaylistClick = (p: Playlist) => {
        this.setState({ selectedPlaylistId: p.id });
    }

    private onTrackClick = (t: Track, index: number) => {
        this.setState({ selectedTrackId: t.track.id });

        const { selectedDevice } = this.props;

        this.api.player.play.put({
            albumUri: this.state.playlists.find((p) => p.id === this.state.selectedPlaylistId)!.uri,
            offset: index,
            ...(selectedDevice ? { deviceId: selectedDevice.id } : {})
        });
    }

}


export default connect(({ selectedDevice }) => {
    return { selectedDevice };
}, void 0)(Spotify);